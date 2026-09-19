import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import path from 'path';

// Load environment configuration
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { getDefaultVoiceAgent } from '../core/default-agent';
import { ExotelStreamHandler } from './exotel-stream-handler';
import { BrowserStreamHandler } from './browser-stream-handler';

const PORT = parseInt(process.env.VOICE_SERVER_PORT || '5050', 10);
const voiceAgent = getDefaultVoiceAgent();

// Create HTTP server for health checks & webhook routing
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/health' || url.pathname === '/') {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'AI Voice Helpline Realtime Voice Server',
      port: PORT,
      providers: {
        gemini: {
          configured: Boolean(process.env.GEMINI_API_KEY),
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        },
        groqWhisper: {
          configured: Boolean(process.env.GROQ_API_KEY),
          model: process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo',
        },
        elevenLabs: {
          configured: Boolean(process.env.ELEVENLABS_API_KEY),
          model: process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5',
        },
        exotel: {
          configured: Boolean(
            process.env.EXOTEL_API_KEY &&
            process.env.EXOTEL_API_TOKEN &&
            process.env.EXOTEL_SID
          ),
          phoneNumber: process.env.EXOTEL_PHONE_NUMBER || 'not_set',
        },
        telegram: {
          configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
          username: process.env.TELEGRAM_BOT_USERNAME || 'not_set',
        },
      },
      endpoints: {
        browserWs: `ws://localhost:${PORT}/ws/browser`,
        exotelWs: `ws://localhost:${PORT}/ws/exotel`,
        exotelWebhook: `http://localhost:${PORT}/api/exotel/inbound`,
      },
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
    return;
  }

  // Exotel Inbound Webhook endpoint
  if (url.pathname === '/api/exotel/inbound' || url.pathname === '/exotel/webhook') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const publicWsUrl =
        process.env.PUBLIC_VOICE_SERVER_WS_URL || `ws://${req.headers.host}/ws/exotel`;
      
      console.log(`[VoiceServer] Inbound Exotel call webhook received from: ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);

      // Generate Exotel XML response directing Exotel to connect to /ws/exotel
      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream url="${publicWsUrl}" bidirectional="true" />
</Response>`.trim();

      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(xmlResponse);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname;

  if (pathname === '/ws/browser') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      new BrowserStreamHandler(ws, voiceAgent);
    });
  } else if (pathname === '/ws/exotel') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      new ExotelStreamHandler(ws, voiceAgent);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`
===================================================================
🎙️  AI VOICE HELPLINE - REALTIME VOICE SERVICE ACTIVE
===================================================================
Port: ${PORT}
HTTP Health:       http://localhost:${PORT}/health
Browser Stream WS: ws://localhost:${PORT}/ws/browser
Exotel Stream WS:  ws://localhost:${PORT}/ws/exotel
Exotel Webhook:    http://localhost:${PORT}/api/exotel/inbound
===================================================================
`);
});
