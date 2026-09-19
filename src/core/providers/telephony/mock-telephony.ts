import { TelephonyProvider } from '../../types/providers';

export class MockTelephonyProvider implements TelephonyProvider {
  public readonly name = 'MockTelephony';
  public activeCalls: Map<string, { to: string; from?: string; status: string }> = new Map();
  public transferHistory: Array<{ callId: string; targetNumber: string }> = new Map<any, any>() as any;

  constructor() {
    this.transferHistory = [];
  }

  public async initialize(): Promise<void> {}

  public async createCall(to: string, from?: string): Promise<{ callId: string }> {
    const callId = `mock_call_${Date.now()}`;
    this.activeCalls.set(callId, { to, from, status: 'active' });
    return { callId };
  }

  public async hangUp(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (call) {
      call.status = 'completed';
    }
  }

  public async transferCall(callId: string, targetNumber: string): Promise<boolean> {
    this.transferHistory.push({ callId, targetNumber });
    const call = this.activeCalls.get(callId);
    if (call) {
      call.status = 'transferred';
    }
    return true;
  }

  public validateWebhook(_headers: Record<string, string>, _body: any): boolean {
    return true;
  }
}
