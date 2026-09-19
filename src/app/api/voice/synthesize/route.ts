import { NextResponse } from 'next/server';
import { ElevenLabsProvider } from '@/core/providers/tts/elevenlabs-provider';

export async function POST(request: Request) {
  try {
    const { text, voiceId } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
    }

    const tts = new ElevenLabsProvider({
      defaultVoiceId: voiceId || process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
      model: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
    });

    const audioBuffer = await tts.synthesizeSpeech(text);

    return new Response(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('[Synthesize API] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Speech synthesis failed' },
      { status: 500 }
    );
  }
}
