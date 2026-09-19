import { TextToSpeechProvider, TTSAudioFormat } from '../../types/providers';

export class MockTextToSpeechProvider implements TextToSpeechProvider {
  public readonly name = 'MockTTS';
  public synthesizedPhrases: string[] = [];

  public async synthesizeSpeech(
    text: string,
    _options?: {
      voiceId?: string;
      model?: string;
      format?: TTSAudioFormat;
      latencyOptimized?: boolean;
    }
  ): Promise<Buffer> {
    this.synthesizedPhrases.push(text);

    // Return a minimal valid 100ms 8kHz mono 16-bit PCM buffer (1600 bytes)
    const pcmSamples = 800; // 800 samples * 2 bytes = 1600 bytes (0.1 sec)
    const buffer = Buffer.alloc(pcmSamples * 2);
    // Fill with a low tone so it is audible if played
    for (let i = 0; i < pcmSamples; i++) {
      const sample = Math.sin((2 * Math.PI * 440 * i) / 8000) * 8000;
      buffer.writeInt16LE(Math.round(sample), i * 2);
    }
    return buffer;
  }
}
