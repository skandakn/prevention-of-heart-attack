import { NextResponse } from 'next/server';
import { getDefaultVoiceAgent } from '@/core/default-agent';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const mode = searchParams.get('mode') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const voiceAgent = getDefaultVoiceAgent();
    const result = await voiceAgent.listCalls({ status, mode, limit, offset });

    // Compute aggregate statistics
    const allCallsResult = await voiceAgent.listCalls({ limit: 1000 });
    const allCalls = allCallsResult.calls;

    const stats = {
      totalCalls: allCalls.length,
      activeCalls: allCalls.filter((c) => c.status === 'active' || c.status === 'initiating').length,
      completedCalls: allCalls.filter((c) => c.status === 'completed').length,
      failedCalls: allCalls.filter((c) => c.status === 'failed').length,
      avgDurationSeconds:
        allCalls.length > 0
          ? Math.round(allCalls.reduce((acc, c) => acc + (c.duration || 0), 0) / allCalls.length)
          : 0,
      modeDistribution: {
        phone: allCalls.filter((c) => c.mode === 'phone').length,
        browser: allCalls.filter((c) => c.mode === 'browser').length,
      },
      criticalEmergencyAlerts: allCalls.filter((c) => {
        const data = c.structuredData || {};
        return (
          data.urgency_level?.value === 'CRITICAL_EMERGENCY' ||
          data.emergency_dispatch_requested?.value === true
        );
      }).length,
    };

    return NextResponse.json({
      calls: result.calls,
      total: result.total,
      stats,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
