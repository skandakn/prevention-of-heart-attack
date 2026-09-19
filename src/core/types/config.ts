import { ExtractionSchema } from './schema';
import { ToolDefinition } from './tools';
import {
  SpeechToTextProvider,
  LLMProvider,
  TextToSpeechProvider,
  TelephonyProvider,
  CallStorageProvider,
  NotificationProvider,
} from './providers';

export interface EscalationRule {
  id: string;
  name: string;
  triggerPhraseOrIntent: string;
  targetTransferNumber?: string;
  escalationReason: string;
  action: 'transfer' | 'flag_for_human' | 'send_telegram_alert';
}

export interface VoiceAgentConfig {
  systemPrompt: string;
  businessContext?: string;
  greeting: string;
  language?: string;
  extractionSchema: ExtractionSchema;
  tools?: ToolDefinition[];
  voiceId?: string;
  ttsModel?: string;
  llmModel?: string;
  escalationRules?: EscalationRule[];
  telegramNotification?: {
    enabled: boolean;
    chatId?: string;
    sendSummary?: boolean;
    sendExtractedData?: boolean;
  };
  providers?: {
    stt?: SpeechToTextProvider;
    llm?: LLMProvider;
    tts?: TextToSpeechProvider;
    telephony?: TelephonyProvider;
    storage?: CallStorageProvider;
    notification?: NotificationProvider;
  };
}
