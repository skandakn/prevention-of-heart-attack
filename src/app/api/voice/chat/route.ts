import { NextResponse } from 'next/server';
import { getDefaultVoiceAgent } from '@/core/default-agent';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      callId = `browser_${Date.now()}`,
      message,
      action = 'utterance', // 'start' | 'utterance' | 'end'
      callerId = 'Patient',
    } = body;

    const voiceAgent = getDefaultVoiceAgent();

    // 1. Start session
    if (action === 'start') {
      const { session, greetingText, greetingAudio } = await voiceAgent.startSession({
        callId,
        callerId,
        mode: 'browser',
      });

      return NextResponse.json({
        success: true,
        callId,
        action: 'start',
        responseText: greetingText,
        audioBase64: greetingAudio ? greetingAudio.toString('base64') : null,
        session,
      });
    }

    // 2. End session
    if (action === 'end') {
      const completedCall = await voiceAgent.endCall(callId);
      return NextResponse.json({
        success: true,
        callId,
        action: 'end',
        completedCall,
      });
    }

    // 3. Process utterance
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    // Ensure session exists
    const activeSession = voiceAgent.getActiveSession(callId);
    if (!activeSession) {
      await voiceAgent.startSession({
        callId,
        callerId,
        mode: 'browser',
      });
    }

    const { responseText, audioBuffer, liveStructuredData, toolExecutions } =
      await voiceAgent.handleCallerUtterance(callId, message);

    return NextResponse.json({
      success: true,
      callId,
      responseText,
      audioBase64: audioBuffer && audioBuffer.length > 0 ? audioBuffer.toString('base64') : null,
      structuredData: liveStructuredData,
      toolExecutions,
    });
  } catch (error: any) {
    console.error('[Voice Chat API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Voice turn processing failed' },
      { status: 500 }
    );
  }
}
