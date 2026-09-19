import { EscalationRule } from '../types/config';
import { CallSession } from '../types/session';
import { TelephonyProvider, NotificationProvider } from '../types/providers';

export interface EscalationResult {
  escalated: boolean;
  actionTaken: 'transferred' | 'flagged' | 'telegram_notified' | 'none';
  ruleMatched?: EscalationRule;
  reason?: string;
  targetNumber?: string;
  error?: string;
}

export class EscalationManager {
  private rules: EscalationRule[] = [];
  private telephonyProvider?: TelephonyProvider;
  private notificationProvider?: NotificationProvider;

  constructor(
    rules: EscalationRule[] = [],
    telephonyProvider?: TelephonyProvider,
    notificationProvider?: NotificationProvider
  ) {
    this.rules = rules;
    this.telephonyProvider = telephonyProvider;
    this.notificationProvider = notificationProvider;
  }

  /**
   * Evaluates caller utterance against configurable escalation rules.
   */
  public evaluateUtterance(utterance: string): EscalationRule | undefined {
    const text = utterance.toLowerCase();
    for (const rule of this.rules) {
      const trigger = rule.triggerPhraseOrIntent.toLowerCase();
      if (text.includes(trigger)) {
        return rule;
      }
    }
    return undefined;
  }

  /**
   * Executes call escalation.
   */
  public async escalateCall(options: {
    callId: string;
    reason: string;
    session: CallSession;
    rule?: EscalationRule;
  }): Promise<EscalationResult> {
    const { callId, reason, session, rule } = options;
    const action = rule?.action || 'flag_for_human';
    const targetNumber = rule?.targetTransferNumber;

    if (action === 'transfer' && targetNumber && this.telephonyProvider) {
      try {
        const transferred = await this.telephonyProvider.transferCall(callId, targetNumber);
        if (transferred) {
          session.status = 'transferred';
          return {
            escalated: true,
            actionTaken: 'transferred',
            ruleMatched: rule,
            reason,
            targetNumber,
          };
        }
      } catch (err: any) {
        console.error('[EscalationManager] Telephony transfer failed:', err.message);
      }
    }

    if (action === 'send_telegram_alert' && this.notificationProvider) {
      await this.notificationProvider.sendMessage({
        callSession: session,
        title: '🚨 Human Escalation Alert',
        message: `Call ${callId} triggered escalation rule: "${rule?.name || reason}". Reason: ${reason}`,
      });
      return {
        escalated: true,
        actionTaken: 'telegram_notified',
        ruleMatched: rule,
        reason,
      };
    }

    // Default fallback: Flag for human supervisor review
    session.status = 'transferred';
    return {
      escalated: true,
      actionTaken: 'flagged',
      ruleMatched: rule,
      reason,
    };
  }
}
