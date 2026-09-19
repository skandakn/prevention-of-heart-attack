import { WebSocket } from 'ws';
import { VoiceAgent } from '../core/agent/voice-agent';
import { ExtractedDataState } from '../core/types/schema';
import { filterAcousticEcho } from '../core/utils/echo-filter';

export class BrowserStreamHandler {
  private ws: WebSocket;
  private voiceAgent: VoiceAgent;
  private callId = '';
  private isProcessing = false;

  constructor(ws: WebSocket, voiceAgent: VoiceAgent) {
    this.ws = ws;
    this.voiceAgent = voiceAgent;
    this.init();
  }

  private init(): void {
    this.ws.on('message', async (data: string | Buffer) => {
      try {
        if (typeof data === 'string' || Buffer.isBuffer(data)) {
          const raw = data.toString();
          // Check if JSON command
          if (raw.startsWith('{')) {
            const msg = JSON.parse(raw);
            await this.handleJsonMessage(msg);
          } else {
            // Binary audio chunk received directly
            await this.handleBinaryAudio(Buffer.isBuffer(data) ? data : Buffer.from(data));
          }
        }
      } catch (err: any) {
        console.error('[BrowserStream] Message handling error:', err.message);
        this.sendError(err.message);
      }
    });

    this.ws.on('close', async () => {
      await this.cleanup();
    });
  }

  private async handleJsonMessage(msg: any): Promise<void> {
    switch (msg.type) {
      case 'session:start': {
        this.callId = msg.callId || `browser_${Date.now()}`;
        const callerId = msg.callerId || 'Local Developer';
        const applicationUserId = msg.applicationUserId;

        console.log(`[BrowserStream] Starting browser session: ${this.callId}`);

        this.send({ type: 'agent:state', state: 'CONNECTING' });

        const { session, greetingText, greetingAudio } = await this.voiceAgent.startSession({
          callId: this.callId,
          callerId,
          mode: 'browser',
          applicationUserId,
          metadata: { userAgent: msg.userAgent },
        });

        // Register live extraction updates
        // Send initial greeting to client
        this.send({
          type: 'session:started',
          callId: this.callId,
          greeting: greetingText,
          structuredData: session.structuredData,
        });

        this.send({
          type: 'transcript:item',
          item: {
            speaker: 'assistant',
            text: greetingText,
            timestamp: Date.now(),
            final: true,
          },
        });

        if (greetingAudio && greetingAudio.length > 0) {
          this.send({
            type: 'audio:playback',
            audioBase64: greetingAudio.toString('base64'),
            mimeType: 'audio/mpeg',
          });
        }

        this.send({ type: 'agent:state', state: 'LISTENING' });
        break;
      }

      case 'audio:utterance': {
        // Direct spoken text (e.g. from Web Speech API or client-side STT fallback)
        const text = (msg.text || '').trim();
        if (!text || !this.callId) return;
        await this.processCallerText(text);
        break;
      }

      case 'audio:chunk': {
        // Base64 encoded audio from browser microphone
        if (!msg.audioBase64 || !this.callId) return;
        const audioBuf = Buffer.from(msg.audioBase64, 'base64');
        const format = msg.mimeType?.includes('wav') ? 'wav' : msg.mimeType?.includes('webm') ? 'webm' : 'pcm';

        try {
          // Transcribe via Groq Whisper STT
          const sttResult = await this.voiceAgent.sttProvider.transcribeAudioChunk(audioBuf, {
            encoding: format as any,
            sampleRate: msg.sampleRate || 16000,
          });

          const callerText = (sttResult.text || '').trim();
          // Filter out trivial Whisper silence tokens like "." or "..." or empty
          if (callerText && callerText !== '.' && callerText !== '...' && callerText.length > 1) {
            await this.processCallerText(callerText);
          } else {
            this.send({ type: 'agent:state', state: 'LISTENING' });
          }
        } catch (err: any) {
          if (process.env.DEBUG_LOGGING === 'true') {
            console.warn('[BrowserStream] STT slice error:', err.message);
          }
          this.send({ type: 'agent:state', state: 'LISTENING' });
        }
        break;
      }

      case 'session:stop': {
        console.log(`[BrowserStream] Stopping session ${this.callId}`);
        await this.finalizeSession();
        break;
      }

      default:
        break;
    }
  }

  private async processCallerText(callerText: string): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Acoustic Echo Cancellation Filter: Check if caller utterance is an acoustic reflection of assistant speech
    const session = this.voiceAgent.sessionManager.getSession(this.callId);
    const recentAssistantTexts = (session?.transcript || [])
      .filter((t) => t.speaker === 'assistant')
      .slice(-3)
      .map((t) => t.text);

    const echoResult = filterAcousticEcho(callerText, recentAssistantTexts);
    if (echoResult.isFullEcho) {
      if (process.env.DEBUG_LOGGING === 'true') {
        console.log(`[BrowserStream] Discarded acoustic speaker echo: "${callerText}"`);
      }
      this.send({ type: 'agent:state', state: 'LISTENING' });
      this.isProcessing = false;
      return;
    }

    const cleanText = echoResult.cleanedText;
    if (echoResult.isPartialEcho) {
      console.log(`[BrowserStream] Stripped speaker echo prefix. Actual caller query: "${cleanText}"`);
    }

    // Send caller transcript item
    this.send({
      type: 'transcript:item',
      item: {
        speaker: 'caller',
        text: cleanText,
        timestamp: Date.now(),
        final: true,
      },
    });

    this.send({ type: 'agent:state', state: 'THINKING' });

    try {
      const turnOutput = await this.voiceAgent.handleCallerUtterance(this.callId, cleanText);

      // Send live structured data update
      this.send({
        type: 'extraction:update',
        structuredData: turnOutput.liveStructuredData,
      });

      // Send assistant transcript item
      this.send({
        type: 'transcript:item',
        item: {
          speaker: 'assistant',
          text: turnOutput.responseText,
          timestamp: Date.now(),
          final: true,
        },
      });

      // Send tool calls info if any
      if (turnOutput.toolExecutions && turnOutput.toolExecutions.length > 0) {
        this.send({
          type: 'tools:executed',
          executions: turnOutput.toolExecutions,
        });
      }

      // Send audio for playback in browser
      if (turnOutput.audioBuffer && turnOutput.audioBuffer.length > 0) {
        this.send({ type: 'agent:state', state: 'SPEAKING' });
        this.send({
          type: 'audio:playback',
          audioBase64: turnOutput.audioBuffer.toString('base64'),
          mimeType: 'audio/mpeg',
        });
      } else {
        this.send({ type: 'agent:state', state: 'LISTENING' });
      }
    } catch (err: any) {
      console.error('[BrowserStream] Error during conversation turn:', err.message);
      this.sendError(err.message);
      this.send({ type: 'agent:state', state: 'LISTENING' });
    } finally {
      this.isProcessing = false;
    }
  }

  private async handleBinaryAudio(audioBuf: Buffer): Promise<void> {
    if (!this.callId) return;
    this.send({ type: 'agent:state', state: 'THINKING' });

    try {
      const sttResult = await this.voiceAgent.sttProvider.transcribeAudioChunk(audioBuf, {
        encoding: 'webm',
        sampleRate: 16000,
      });

      const text = (sttResult.text || '').trim();
      if (text) {
        await this.processCallerText(text);
      } else {
        this.send({ type: 'agent:state', state: 'LISTENING' });
      }
    } catch (e: any) {
      console.error('[BrowserStream] Binary audio error:', e.message);
      this.send({ type: 'agent:state', state: 'LISTENING' });
    }
  }

  private async finalizeSession(): Promise<void> {
    if (!this.callId) return;

    this.send({ type: 'agent:state', state: 'FINALIZING' });

    try {
      const completedSession = await this.voiceAgent.endCall(this.callId, 'completed');
      this.send({
        type: 'session:completed',
        session: completedSession,
        summary: completedSession.summary,
        finalStructuredData: completedSession.structuredData,
      });
    } catch (err: any) {
      console.error('[BrowserStream] Finalize error:', err.message);
      this.sendError(err.message);
    } finally {
      this.send({ type: 'agent:state', state: 'DISCONNECTED' });
      this.callId = '';
    }
  }

  private async cleanup(): Promise<void> {
    if (this.callId) {
      try {
        await this.voiceAgent.endCall(this.callId);
      } catch {}
    }
  }

  private send(data: any): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private sendError(message: string): void {
    this.send({ type: 'error', message });
  }
}
