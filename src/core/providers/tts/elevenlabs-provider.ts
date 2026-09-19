import { TextToSpeechProvider, TTSAudioFormat } from '../../types/providers';

export interface ElevenLabsConfig {
  apiKey?: string;
  defaultVoiceId?: string;
  model?: string;
  baseUrl?: string;
}

export class ElevenLabsProvider implements TextToSpeechProvider {
  public readonly name = 'ElevenLabs';
  private apiKey: string;
  private defaultVoiceId: string;
  private model: string;
  private baseUrl: string;

  constructor(config?: ElevenLabsConfig) {
    this.apiKey = config?.apiKey || process.env.ELEVENLABS_API_KEY || '';
    // Default to Rachel if not configured: 21m00Tcm4TlvDq8ikWAM
    this.defaultVoiceId = config?.defaultVoiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    // Preferred low-latency model specified by user: eleven_flash_v2_5
    this.model = config?.model || process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5';
    this.baseUrl = config?.baseUrl || 'https://api.elevenlabs.io/v1';
  }

  public async synthesizeSpeech(
    text: string,
    options?: {
      voiceId?: string;
      model?: string;
      format?: TTSAudioFormat;
      latencyOptimized?: boolean;
    }
  ): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API Key is not configured. Set ELEVENLABS_API_KEY in environment variables.');
    }

    if (!text || text.trim().length === 0) {
      return Buffer.alloc(0);
    }

    const voiceId = options?.voiceId || this.defaultVoiceId;
    const modelId = options?.model || this.model;

    // Map audio format to ElevenLabs output_format parameter
    let outputFormat = 'mp3_44100_128';
    if (options?.format?.container === 'mulaw') {
      outputFormat = 'ulaw_8000';
    } else if (options?.format?.container === 'pcm') {
      outputFormat = options.format.sampleRate === 8000 ? 'pcm_8000' : 'pcm_16000';
    }

    const url = `${this.baseUrl}/text-to-speech/${voiceId}?output_format=${outputFormat}&optimize_streaming_latency=3`;

    const requestBody = {
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        use_speaker_boost: true,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: options?.format?.container === 'mulaw' ? 'audio/basic' : 'audio/mpeg',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs TTS error (${response.status}): ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      if (process.env.DEBUG_LOGGING === 'true') {
        console.error('[ElevenLabsProvider] TTS synthesis failed:', error.message);
      }
      throw error;
    }
  }
}
