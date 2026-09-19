import { NextResponse } from 'next/server';
import { ExotelProvider } from '@/core/providers/telephony/exotel-provider';

export async function POST(request: Request) {
  try {
    const { to, from } = await request.json();

    if (!to) {
      return NextResponse.json(
        { error: 'Destination phone number (to) is required' },
        { status: 400 }
      );
    }

    const exotel = new ExotelProvider();
    if (!exotel.isConfigured()) {
      return NextResponse.json(
        {
          error: 'Exotel telephony credentials are not configured.',
          configured: false,
        },
        { status: 500 }
      );
    }

    const result = await exotel.createCall(to, from);

    return NextResponse.json({
      success: true,
      callId: result.callId,
      message: `Outbound triage phone call dispatched to ${to}`,
    });
  } catch (error: any) {
    console.error('[Exotel Call API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Exotel call initiation failed' },
      { status: 500 }
    );
  }
}
