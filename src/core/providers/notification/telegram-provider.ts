import crypto from 'crypto';
import {
  NotificationProvider,
  TelegramNotificationPayload,
} from '../../types/providers';

export interface TelegramConfig {
  botToken?: string;
  botUsername?: string;
}

export class TelegramProvider implements NotificationProvider {
  public readonly name = 'Telegram';
  private botToken: string;
  private botUsername: string;
  private tokenStore: Map<string, { userId: string; expiresAt: number }> = new Map();
  private userChatMap: Map<string, string> = new Map();

  constructor(config?: TelegramConfig) {
    this.botToken = config?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    this.botUsername = config?.botUsername || process.env.TELEGRAM_BOT_USERNAME || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.botToken && this.botToken.length > 5);
  }

  /**
   * Generates a secure deep link token for linking an application user to a Telegram chat.
   * Format: https://t.me/{botUsername}?start={token}
   */
  public async generateUserLinkingToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    this.tokenStore.set(token, { userId, expiresAt });
    return token;
  }

  public getDeepLinkUrl(token: string): string {
    const username = this.botUsername.replace('@', '');
    return `https://t.me/${username}?start=link_${token}`;
  }

  /**
   * Links a user to a chat ID when the bot receives /start link_{token}
   */
  public registerChatForToken(token: string, chatId: string): boolean {
    const record = this.tokenStore.get(token);
    if (!record || record.expiresAt < Date.now()) {
      return false;
    }
    this.userChatMap.set(record.userId, chatId);
    this.tokenStore.delete(token);
    return true;
  }

  /**
   * Sends a structured Telegram notification message.
   */
  public async sendMessage(payload: TelegramNotificationPayload): Promise<boolean> {
    if (!this.isConfigured()) {
      if (process.env.DEBUG_LOGGING === 'true') {
        console.log('[TelegramProvider] Telegram bot token not configured. Skipping notification.');
      }
      return false;
    }

    // Determine target chat ID
    let targetChatId = payload.chatId;
    if (!targetChatId && payload.callSession?.applicationUserId) {
      targetChatId = this.userChatMap.get(payload.callSession.applicationUserId);
    }

    if (!targetChatId) {
      if (process.env.DEBUG_LOGGING === 'true') {
        console.warn('[TelegramProvider] No target chatId found for notification. Skipping.');
      }
      return false;
    }

    // Format rich text message
    let text = `📞 *${escapeMarkdown(payload.title || 'AI Voice Helpline Notification')}*\n\n`;
    text += `${escapeMarkdown(payload.message)}\n\n`;

    if (payload.callSession) {
      const s = payload.callSession;
      text += `*Session Details:*\n`;
      text += `• *Call ID:* \`${escapeMarkdown(s.callId)}\`\n`;
      text += `• *Caller:* \`${escapeMarkdown(s.callerId)}\`\n`;
      text += `• *Mode:* ${s.mode === 'phone' ? '📱 Phone' : '💻 Browser'}\n`;
      text += `• *Duration:* ${Math.round(s.duration)}s\n`;
      text += `• *Status:* ${escapeMarkdown(s.status)}\n\n`;

      if (s.summary) {
        text += `*AI Summary:*\n${escapeMarkdown(s.summary.rawSummaryText)}\n\n`;
        if (s.summary.actionsTaken.length > 0) {
          text += `*Actions Taken:*\n`;
          for (const action of s.summary.actionsTaken) {
            text += `• ${escapeMarkdown(action)}\n`;
          }
          text += `\n`;
        }
      }
    }

    if (payload.structuredData && Object.keys(payload.structuredData).length > 0) {
      text += `*Extracted Structured Data:*\n\`\`\`json\n`;
      text += JSON.stringify(payload.structuredData, null, 2);
      text += `\n\`\`\`\n`;
    }

    const endpoint = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text,
          parse_mode: 'Markdown',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TelegramProvider] Telegram API error:', errorText);
        return false;
      }

      return true;
    } catch (err: any) {
      console.error('[TelegramProvider] Failed to dispatch Telegram message:', err.message);
      return false;
    }
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}
