import { NextResponse } from 'next/server';
import { getDefaultVoiceAgent } from '@/core/default-agent';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const callId = resolvedParams.id;
    const voiceAgent = getDefaultVoiceAgent();
    const callRecord = await voiceAgent.getCall(callId);

    if (!callRecord) {
      return NextResponse.json({ error: 'Call record not found' }, { status: 404 });
    }

    return NextResponse.json({ call: callRecord });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
