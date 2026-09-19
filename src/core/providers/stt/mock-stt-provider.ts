import { SpeechToTextProvider, STTTranscriptionResult } from '../../types/providers';

export class MockSpeechToTextProvider implements SpeechToTextProvider {
  public readonly name = 'MockSTT';
  private queuedTranscriptions: string[] = [];
  private callCount = 0;

  constructor(initialQueue: string[] = []) {
    this.queuedTranscriptions = [...initialQueue];
  }

  public queueUtterance(text: string): void {
    this.queuedTranscriptions.push(text);
  }

  public async transcribeAudioChunk(
    audioBuffer: Buffer,
    _format: { encoding: string; sampleRate: number }
  ): Promise<STTTranscriptionResult> {
    this.callCount++;

    if (this.queuedTranscriptions.length > 0) {
      const text = this.queuedTranscriptions.shift()!;
      return {
        text,
        isFinal: true,
        confidence: 0.98,
        durationMs: 40,
      };
    }

    return {
      text: `[Mock Audio Input ${this.callCount}]`,
      isFinal: true,
      confidence: 0.90,
      durationMs: 30,
    };
  }
}
