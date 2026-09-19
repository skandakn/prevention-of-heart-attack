import { NextResponse } from 'next/server';
import { GroqWhisperProvider } from '@/core/providers/stt/groq-whisper-provider';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob | null;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const whisper = new GroqWhisperProvider();
    const result = await whisper.transcribeAudioChunk(buffer, {
      encoding: 'webm',
      sampleRate: 16000,
    });

    return NextResponse.json({
      text: result.text,
      isFinal: result.isFinal,
      durationMs: result.durationMs,
    });
  } catch (error: any) {
    console.error('[Transcribe API] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Speech-to-text failed' },
      { status: 500 }
    );
  }
}
