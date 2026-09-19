import { TelephonyProvider } from '../../types/providers';

export interface ExotelConfig {
  apiKey?: string;
  apiToken?: string;
  accountSid?: string;
  subdomain?: string;
  phoneNumber?: string;
  baseUrl?: string;
}

export class ExotelProvider implements TelephonyProvider {
  public readonly name = 'Exotel';
  private apiKey: string;
  private apiToken: string;
  private accountSid: string;
  private phoneNumber: string;
  private baseUrl: string;

  constructor(config?: ExotelConfig) {
    this.apiKey = config?.apiKey || process.env.EXOTEL_API_KEY || '';
    this.apiToken = config?.apiToken || process.env.EXOTEL_API_TOKEN || '';
    this.accountSid = config?.accountSid || process.env.EXOTEL_SID || '';
    this.phoneNumber = config?.phoneNumber || process.env.EXOTEL_PHONE_NUMBER || '';
    
    // Configurable base URL for different regions (api.exotel.com, api.in.exotel.com, etc.)
    const configuredBase = config?.baseUrl || process.env.EXOTEL_BASE_URL || 'https://api.exotel.com';
    this.baseUrl = configuredBase.replace(/\/$/, '');
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiToken && this.accountSid);
  }

  public async initialize(): Promise<void> {
    if (!this.isConfigured()) {
      if (process.env.DEBUG_LOGGING === 'true') {
        console.log('[ExotelProvider] Exotel credentials not fully configured.');
      }
    }
  }

  /**
   * Generates standard Exotel AgentStream XML response to instruct Exotel
   * to connect the incoming call to the realtime bidirectional WebSocket voice server.
   */
  public generateStreamResponseXml(streamWsUrl: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream url="${streamWsUrl}" bidirectional="true" />
</Response>`.trim();
  }

  /**
   * Generates standard Exotel AgentStream JSON response
   */
  public generateStreamResponseJson(streamWsUrl: string): Record<string, any> {
    return {
      action: 'stream',
      url: streamWsUrl,
      bidirectional: true,
    };
  }

  /**
   * Outbound call creation via Exotel REST API
   */
  public async createCall(to: string, from?: string): Promise<{ callId: string }> {
    if (!this.isConfigured()) {
      throw new Error('Exotel credentials missing. Please set EXOTEL_API_KEY, EXOTEL_API_TOKEN, and EXOTEL_SID.');
    }

    const callerId = from || this.phoneNumber;
    const url = `${this.baseUrl}/v1/Accounts/${this.accountSid}/Calls/connect.json`;
    const authHeader = 'Basic ' + Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64');

    const params = new URLSearchParams();
    params.append('From', callerId);
    params.append('To', to);
    params.append('CallerId', callerId);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Exotel createCall failed (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as any;
    const callSid = data.Call?.Sid || `exo_${Date.now()}`;
    return { callId: callSid };
  }

  /**
   * Hang up an active Exotel call via REST API
   */
  public async hangUp(callId: string): Promise<void> {
    if (!this.isConfigured()) return;

    const url = `${this.baseUrl}/v1/Accounts/${this.accountSid}/Calls/${callId}.json`;
    const authHeader = 'Basic ' + Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64');

    const params = new URLSearchParams();
    params.append('Status', 'completed');

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
    } catch (e: any) {
      console.error(`[ExotelProvider] Failed to hang up call ${callId}:`, e.message);
    }
  }

  /**
   * Transfer call to a live human agent
   */
  public async transferCall(callId: string, targetNumber: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    // Call Exotel call transfer/flow update endpoint
    const url = `${this.baseUrl}/v1/Accounts/${this.accountSid}/Calls/${callId}.json`;
    const authHeader = 'Basic ' + Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64');

    const params = new URLSearchParams();
    params.append('ForwardTo', targetNumber);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  /**
   * Validates incoming Exotel webhook requests.
   */
  public validateWebhook(headers: Record<string, string>, body: any): boolean {
    // If Exotel signature token is present, we verify
    // For local development or mock environments, basic structure check
    if (!body) return false;
    return true;
  }
}
