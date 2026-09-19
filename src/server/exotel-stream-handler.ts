import { WebSocket } from 'ws';
import { VoiceAgent } from '../core/agent/voice-agent';
import { AudioProcessor } from './audio-processor';

export class ExotelStreamHandler {
  private ws: WebSocket;
  private voiceAgent: VoiceAgent;
  private callSid = '';
  private streamSid = '';
  private audioChunks: Buffer[] = [];
  private isProcessingTurn = false;
  private lastAudioTime = 0;
  private silenceTimer: NodeJS.Timeout | null = null;
  private speechDetected = false;

  // Silence threshold: 800ms of low audio energy signals end of caller speech
  private readonly SILENCE_TIMEOUT_MS = 800;
  private readonly ENERGY_THRESHOLD = 300; // RMS threshold for voice activity

  constructor(ws: WebSocket, voiceAgent: VoiceAgent) {
    this.ws = ws;
    this.voiceAgent = voiceAgent;
    this.init();
  }

  private init(): void {
    this.ws.on('message', async (data: string) => {
      try {
        const msg = JSON.parse(data.toString());
        await this.handleMessage(msg);
      } catch (err: any) {
        console.error('[ExotelStream] Error processing message:', err.message);
      }
    });

    this.ws.on('close', async () => {
      await this.handleClose();
    });

    this.ws.on('error', (err) => {
      console.error('[ExotelStream] WebSocket error:', err.message);
    });
  }

  private async handleMessage(msg: any): Promise<void> {
    switch (msg.event) {
      case 'connected':
        if (process.env.DEBUG_LOGGING === 'true') {
          console.log('[ExotelStream] Protocol connected:', msg.protocol, msg.version);
        }
        break;

      case 'start': {
        this.streamSid = msg.streamSid || msg.start?.streamSid;
        this.callSid = msg.start?.callSid || `exo_${Date.now()}`;
        const from = msg.start?.customParameters?.From || msg.start?.from || 'Unknown Caller';

        console.log(`[ExotelStream] Call started: ${this.callSid}, Stream: ${this.streamSid}`);

        // Start session in voice agent
        const { greetingText, greetingAudio } = await this.voiceAgent.startSession({
          callId: this.callSid,
          callerId: from,
          mode: 'phone',
          metadata: {
            streamSid: this.streamSid,
            accountSid: msg.start?.accountSid,
          },
        });

        // Send initial greeting audio back to Exotel
        if (greetingAudio && greetingAudio.length > 0) {
          this.sendAudioToExotel(greetingAudio);
        }
        break;
      }

      case 'media': {
        if (!msg.media?.payload) return;
        // Exotel sends 8kHz Mu-law base64 audio
        const mulawChunk = Buffer.from(msg.media.payload, 'base64');
        const pcmChunk = AudioProcessor.mulawToPcm(mulawChunk);

        // Calculate energy
        const energy = AudioProcessor.calculateRms(pcmChunk);
        this.lastAudioTime = Date.now();

        if (energy > this.ENERGY_THRESHOLD) {
          this.speechDetected = true;
          this.audioChunks.push(pcmChunk);

          // Clear previous silence timeout
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
          }

          // Set silence timeout to detect end of speech turn
          this.silenceTimer = setTimeout(async () => {
            if (this.speechDetected && this.audioChunks.length > 0 && !this.isProcessingTurn) {
              await this.processCallerSpeechTurn();
            }
          }, this.SILENCE_TIMEOUT_MS);
        } else if (this.speechDetected) {
          // Keep buffering slight trailing silence
          this.audioChunks.push(pcmChunk);
        }
        break;
      }

      case 'stop': {
        console.log(`[ExotelStream] Call stopped: ${this.callSid}`);
        await this.handleClose();
        break;
      }

      default:
        break;
    }
  }

  /**
   * Called when end-of-speech silence is detected.
   * Transcribes audio via Groq Whisper and generates AI response.
   */
  private async processCallerSpeechTurn(): Promise<void> {
    if (this.isProcessingTurn || this.audioChunks.length === 0) return;
    this.isProcessingTurn = true;
    this.speechDetected = false;

    const fullPcm = Buffer.concat(this.audioChunks);
    this.audioChunks = [];

    // Minimum audio duration check (~300ms = 4800 bytes at 8kHz 16-bit mono)
    if (fullPcm.length < 4800) {
      this.isProcessingTurn = false;
      return;
    }

    try {
      // 1. Transcribe via Groq Whisper STT
      const wavAudio = AudioProcessor.wrapPcmInWav(fullPcm, 8000, 1);
      const sttResult = await this.voiceAgent.sttProvider.transcribeAudioChunk(wavAudio, {
        encoding: 'wav',
        sampleRate: 8000,
      });

      const transcript = (sttResult.text || '').trim();
      if (!transcript) {
        this.isProcessingTurn = false;
        return;
      }

      console.log(`[ExotelStream] Caller: "${transcript}"`);

      // 2. Handle turn through VoiceAgent (dispatches parallel extraction & generates response)
      const turnOutput = await this.voiceAgent.handleCallerUtterance(this.callSid, transcript);
      console.log(`[ExotelStream] Assistant: "${turnOutput.responseText}"`);

      // 3. Send synthesized audio back to Exotel
      if (turnOutput.audioBuffer && turnOutput.audioBuffer.length > 0) {
        this.sendAudioToExotel(turnOutput.audioBuffer);
      }
    } catch (err: any) {
      console.error('[ExotelStream] Speech turn error:', err.message);
    } finally {
      this.isProcessingTurn = false;
    }
  }

  /**
   * Encodes audio to Mu-law and sends back to Exotel AgentStream WebSocket.
   */
  private sendAudioToExotel(audioBuffer: Buffer): void {
    if (this.ws.readyState !== WebSocket.OPEN) return;

    // Convert PCM to mu-law if needed, or send directly if already mu-law
    const mulawPayload = audioBuffer.toString('base64');

    const mediaMessage = JSON.stringify({
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload: mulawPayload,
      },
    });

    this.ws.send(mediaMessage);

    // Send mark event
    const markMessage = JSON.stringify({
      event: 'mark',
      streamSid: this.streamSid,
      mark: {
        name: `turn_${Date.now()}`,
      },
    });

    this.ws.send(markMessage);
  }

  private async handleClose(): Promise<void> {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.callSid) {
      try {
        console.log(`[ExotelStream] Finalizing call ${this.callSid}...`);
        await this.voiceAgent.endCall(this.callSid);
      } catch (e: any) {
        console.error('[ExotelStream] Error finalizing call:', e.message);
      }
    }
  }
}
