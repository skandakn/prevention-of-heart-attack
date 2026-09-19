import { SpeechToTextProvider, STTTranscriptionResult } from '../../types/providers';

export interface GroqWhisperConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class GroqWhisperProvider implements SpeechToTextProvider {
  public readonly name = 'GroqWhisper';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config?: GroqWhisperConfig) {
    this.apiKey = config?.apiKey || process.env.GROQ_API_KEY || '';
    this.model = config?.model || process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';
    this.baseUrl = config?.baseUrl || 'https://api.groq.com/openai/v1/audio/transcriptions';
  }

  public async transcribeAudioChunk(
    audioBuffer: Buffer,
    format: { encoding: 'pcm' | 'mulaw' | 'mp3' | 'wav' | 'webm'; sampleRate: number }
  ): Promise<STTTranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('Groq API Key is not configured. Set GROQ_API_KEY in environment variables.');
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return { text: '', isFinal: false };
    }

    const startTime = Date.now();

    // Prepare audio payload as multipart form-data
    // Wrap raw PCM or other formats into a WAV container if needed so Whisper parses it reliably
    const wavBuffer = format.encoding === 'wav' || format.encoding === 'webm' || format.encoding === 'mp3'
      ? audioBuffer
      : this.wrapPcmInWav(audioBuffer, format.sampleRate);

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const filename = `audio_${Date.now()}.${format.encoding === 'webm' ? 'webm' : 'wav'}`;
    const mimeType = format.encoding === 'webm' ? 'audio/webm' : 'audio/wav';

    // Build multipart/form-data payload
    const formParts: Buffer[] = [];

    // 1. Model field
    formParts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${this.model}\r\n`
      )
    );

    // 2. Response format
    formParts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`
      )
    );

    // 3. Audio file field
    formParts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
      )
    );
    formParts.push(wavBuffer);
    formParts.push(Buffer.from('\r\n'));

    // End boundary
    formParts.push(Buffer.from(`--${boundary}--\r\n`));

    const fullBody = Buffer.concat(formParts);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: fullBody,
      });

      if (!response.ok) {
        const errText = await response.text();
        // If empty audio chunk or invalid media slice, fail gracefully with empty transcript
        if (response.status === 400 && errText.includes('invalid_media_file')) {
          if (process.env.DEBUG_LOGGING === 'true') {
            console.warn('[GroqWhisperProvider] Incomplete audio slice received, ignoring slice.');
          }
          return { text: '', isFinal: false };
        }
        throw new Error(`Groq Whisper API returned ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as { text?: string };
      const durationMs = Date.now() - startTime;
      const text = (data.text || '').trim();

      return {
        text,
        isFinal: true,
        confidence: 0.95,
        durationMs,
      };
    } catch (error: any) {
      if (process.env.DEBUG_LOGGING === 'true') {
        console.error('[GroqWhisperProvider] STT transcription failed:', error.message);
      }
      throw error;
    }
  }

  /**
   * Helper to wrap raw 16-bit linear PCM audio into a minimal standard WAV header.
   */
  private wrapPcmInWav(pcmData: Buffer, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmData.length;
    const header = Buffer.alloc(44);

    // RIFF identifier
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);

    // fmt sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
    header.writeUInt16LE(1, 20); // AudioFormat 1 = PCM
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
  }
}
