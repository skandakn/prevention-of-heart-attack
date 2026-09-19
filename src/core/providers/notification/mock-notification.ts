import {
  NotificationProvider,
  TelegramNotificationPayload,
} from '../../types/providers';

export class MockNotificationProvider implements NotificationProvider {
  public readonly name = 'MockNotification';
  public sentMessages: TelegramNotificationPayload[] = [];

  public async sendMessage(payload: TelegramNotificationPayload): Promise<boolean> {
    this.sentMessages.push(payload);
    return true;
  }

  public async generateUserLinkingToken(userId: string): Promise<string> {
    return `mock_token_${userId}_${Date.now()}`;
  }
}
