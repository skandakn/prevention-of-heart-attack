import { CallSession } from './session';
import { TranscriptItem } from './transcript';
import { ExtractedDataState, ExtractionSchema } from './schema';
import { ToolDefinition, ToolCallResult } from './tools';

export interface TelephonyCallEvent {
  callId: string;
  callerId: string;
  eventType: 'incoming' | 'answered' | 'audio' | 'hangup' | 'error';
  payload?: any;
}

export interface TelephonyProvider {
  name: string;
  initialize(): Promise<void>;
  createCall(to: string, from?: string): Promise<{ callId: string }>;
  hangUp(callId: string): Promise<void>;
  transferCall(callId: string, targetNumber: string): Promise<boolean>;
  validateWebhook(headers: Record<string, string>, body: any): boolean;
}

export interface STTTranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
  durationMs?: number;
}

export interface SpeechToTextProvider {
  name: string;
  transcribeAudioChunk(
    audioBuffer: Buffer,
    format: { encoding: 'pcm' | 'mulaw' | 'mp3' | 'wav' | 'webm'; sampleRate: number }
  ): Promise<STTTranscriptionResult>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LLMGenerateOptions {
  messages: LLMMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

export interface LLMResponse {
  text: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  name: string;
  generateResponse(options: LLMGenerateOptions): Promise<LLMResponse>;
  extractStructuredData(
    transcriptText: string,
    currentData: ExtractedDataState,
    schema: ExtractionSchema
  ): Promise<ExtractedDataState>;
  reconcileFinalData(
    fullTranscript: TranscriptItem[],
    currentData: ExtractedDataState,
    schema: ExtractionSchema
  ): Promise<{ data: ExtractedDataState; notes?: string }>;
  generateSummary(
    transcript: TranscriptItem[],
    structuredData: ExtractedDataState
  ): Promise<{
    reasonForCall: string;
    keyInformationProvided: string[];
    actionsTaken: string[];
    recommendations: string[];
    unresolvedIssues: string[];
    escalationStatus: 'none' | 'requested' | 'transferred' | 'failed';
    importantFollowUpItems: string[];
    rawSummaryText: string;
  }>;
}

export interface TTSAudioFormat {
  container: 'mp3' | 'pcm' | 'mulaw' | 'wav';
  sampleRate: number; // e.g. 8000 for telephony, 24000 or 44100 for web
}

export interface TextToSpeechProvider {
  name: string;
  synthesizeSpeech(
    text: string,
    options?: {
      voiceId?: string;
      model?: string;
      format?: TTSAudioFormat;
      latencyOptimized?: boolean;
    }
  ): Promise<Buffer>;
}

export interface CallStorageProvider {
  name: string;
  saveCall(session: CallSession): Promise<void>;
  getCall(callId: string): Promise<CallSession | null>;
  listCalls(filter?: {
    status?: string;
    mode?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ calls: CallSession[]; total: number }>;
  deleteCall(callId: string): Promise<boolean>;
}

export interface TelegramNotificationPayload {
  chatId?: string;
  callSession?: CallSession;
  title?: string;
  message: string;
  structuredData?: Record<string, any>;
  deepLinkToken?: string;
}

export interface NotificationProvider {
  name: string;
  sendMessage(payload: TelegramNotificationPayload): Promise<boolean>;
  generateUserLinkingToken?(userId: string): Promise<string>;
}
