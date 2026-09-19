import { NextResponse } from 'next/server';
import { ExotelProvider } from '@/core/providers/telephony/exotel-provider';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        body[key] = value.toString();
      });
    }

    const exotel = new ExotelProvider();
    const wsUrl = process.env.PUBLIC_VOICE_SERVER_WS_URL || 'ws://localhost:5050';
    const streamWsUrl = `${wsUrl}/ws/exotel`;

    // Generate Exotel AgentStream XML
    const xmlResponse = exotel.generateStreamResponseXml(streamWsUrl);

    return new Response(xmlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error: any) {
    console.error('[Exotel Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const wsUrl = process.env.PUBLIC_VOICE_SERVER_WS_URL || 'ws://localhost:5050';
  return NextResponse.json({
    status: 'active',
    service: 'BeatAhead Exotel AgentStream Webhook',
    streamWsUrl: `${wsUrl}/ws/exotel`,
  });
}
