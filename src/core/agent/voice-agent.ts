import { VoiceAgentConfig } from '../types/config';
import { CallSession, CallSummary, CallMode } from '../types/session';
import { TranscriptItem } from '../types/transcript';
import { ExtractedDataState, ExtractionSchema } from '../types/schema';
import { ToolDefinition } from '../types/tools';
import {
  SpeechToTextProvider,
  LLMProvider,
  TextToSpeechProvider,
  TelephonyProvider,
  CallStorageProvider,
  NotificationProvider,
  TelegramNotificationPayload,
} from '../types/providers';

import { GroqWhisperProvider } from '../providers/stt/groq-whisper-provider';
import { GeminiProvider } from '../providers/llm/gemini-provider';
import { ElevenLabsProvider } from '../providers/tts/elevenlabs-provider';
import { ExotelProvider } from '../providers/telephony/exotel-provider';
import { LocalStorageProvider } from '../providers/storage/local-storage';
import { TelegramProvider } from '../providers/notification/telegram-provider';

import { ToolRegistry } from '../tools/tool-registry';
import { EscalationManager, EscalationResult } from '../escalation/escalation-manager';
import { ParallelExtractor } from '../extraction/parallel-extractor';
import { ReconciliationEngine } from '../extraction/reconciliation-engine';
import { SummaryGenerator } from '../summary/summary-generator';
import { ConversationManager } from '../conversation/conversation-manager';
import { SessionManager } from './session-manager';

export interface CallerTurnOutput {
  responseText: string;
  audioBuffer?: Buffer;
  liveStructuredData: ExtractedDataState;
  escalation?: EscalationResult;
  toolExecutions: any[];
}

export class VoiceAgent {
  public readonly config: VoiceAgentConfig;
  public readonly sttProvider: SpeechToTextProvider;
  public readonly llmProvider: LLMProvider;
  public readonly ttsProvider: TextToSpeechProvider;
  public readonly telephonyProvider: TelephonyProvider;
  public readonly storageProvider: CallStorageProvider;
  public readonly notificationProvider: NotificationProvider;

  public readonly toolRegistry: ToolRegistry;
  public readonly escalationManager: EscalationManager;
  public readonly sessionManager: SessionManager;
  public readonly reconciliationEngine: ReconciliationEngine;
  public readonly summaryGenerator: SummaryGenerator;

  // Active per-call parallel extractors and conversation managers
  public readonly activeExtractors: Map<string, ParallelExtractor> = new Map();
  public readonly activeConversations: Map<string, ConversationManager> = new Map();

  constructor(config: VoiceAgentConfig) {
    this.config = config;

    // Initialize or inject providers
    this.sttProvider = config.providers?.stt || new GroqWhisperProvider();
    this.llmProvider = config.providers?.llm || new GeminiProvider();
    this.ttsProvider = config.providers?.tts || new ElevenLabsProvider();
    this.telephonyProvider = config.providers?.telephony || new ExotelProvider();
    this.storageProvider = config.providers?.storage || new LocalStorageProvider();
    this.notificationProvider = config.providers?.notification || new TelegramProvider();

    // Core managers
    this.toolRegistry = new ToolRegistry(config.tools || []);
    this.escalationManager = new EscalationManager(
      config.escalationRules || [],
      this.telephonyProvider,
      this.notificationProvider
    );
    this.sessionManager = new SessionManager(this.storageProvider, config.extractionSchema);
    this.reconciliationEngine = new ReconciliationEngine(config.extractionSchema, this.llmProvider);
    this.summaryGenerator = new SummaryGenerator(this.llmProvider);
  }

  /**
   * Registers an additional tool dynamically.
   */
  public registerTool(tool: ToolDefinition): void {
    this.toolRegistry.registerTool(tool);
  }

  /**
   * Retrieves an active in-memory session if available.
   */
  public getActiveSession(callId: string): CallSession | undefined {
    return this.sessionManager.getSession(callId);
  }

  /**
   * Starts a new call session and initializes conversation + parallel extraction.
   */
  public async startSession(options: {
    callId: string;
    callerId: string;
    mode: CallMode;
    applicationUserId?: string;
    metadata?: Record<string, any>;
  }): Promise<{ session: CallSession; greetingText: string; greetingAudio?: Buffer }> {
    const session = this.sessionManager.createSession({
      callId: options.callId,
      callerId: options.callerId,
      mode: options.mode,
      applicationUserId: options.applicationUserId,
      language: this.config.language || 'en',
      metadata: options.metadata,
    });

    this.sessionManager.updateStatus(session.callId, 'active');

    // Create Conversation Manager for this session
    const conversation = new ConversationManager({
      llmProvider: this.llmProvider,
      toolRegistry: this.toolRegistry,
      systemPrompt: this.config.systemPrompt,
      businessContext: this.config.businessContext,
      greeting: this.config.greeting,
      language: this.config.language || 'en',
    });

    const { greeting, initialItem } = conversation.initialize();
    this.sessionManager.addTranscriptItem(session.callId, initialItem);
    this.activeConversations.set(session.callId, conversation);

    // Create Parallel Extractor for this session
    const extractor = new ParallelExtractor(
      this.config.extractionSchema,
      this.llmProvider,
      session.structuredData
    );

    extractor.onUpdate((state) => {
      this.sessionManager.updateStructuredData(session.callId, state);
    });

    this.activeExtractors.set(session.callId, extractor);

    // Pre-synthesize greeting audio if TTS provider is available
    let greetingAudio: Buffer | undefined;
    try {
      greetingAudio = await this.ttsProvider.synthesizeSpeech(greeting, {
        voiceId: this.config.voiceId,
        model: this.config.ttsModel,
        format: options.mode === 'phone' ? { container: 'mulaw', sampleRate: 8000 } : { container: 'mp3', sampleRate: 44100 },
        latencyOptimized: true,
      });
    } catch (e: any) {
      if (process.env.DEBUG_LOGGING === 'true') {
        console.warn('[VoiceAgent] Could not synthesize greeting audio:', e.message);
      }
    }

    return {
      session,
      greetingText: greeting,
      greetingAudio,
    };
  }

  /**
   * Processes caller's transcribed utterance:
   * 1. Appends to transcript.
   * 2. Checks for escalation conditions.
   * 3. Dispatches utterance to PARALLEL EXTRACTION ENGINE (non-blocking).
   * 4. Dispatches utterance to CONVERSATION AGENT -> produces spoken reply.
   * 5. Synthesizes reply audio via TTS.
   */
  public async handleCallerUtterance(
    callId: string,
    callerText: string
  ): Promise<CallerTurnOutput> {
    const session = this.sessionManager.getSession(callId);
    if (!session) {
      throw new Error(`Session ${callId} not found.`);
    }

    const trimmedText = callerText.trim();

    // 1. Add caller item to transcript
    const callerItem: TranscriptItem = {
      id: `item_${Date.now()}_caller`,
      speaker: 'caller',
      text: trimmedText,
      timestamp: Date.now(),
      final: true,
    };
    this.sessionManager.addTranscriptItem(callId, callerItem);

    // 2. Check for human escalation trigger
    let escalationResult: EscalationResult | undefined;
    const matchedRule = this.escalationManager.evaluateUtterance(trimmedText);
    if (matchedRule) {
      escalationResult = await this.escalationManager.escalateCall({
        callId,
        reason: `Matched phrase: "${matchedRule.triggerPhraseOrIntent}"`,
        session,
        rule: matchedRule,
      });
    }

    // 3 & 4. Concurrent execution: Conversation Agent response + Structured Data Extraction pass
    const extractor = this.activeExtractors.get(callId);
    if (extractor) {
      extractor.enqueueUtterance(trimmedText);
    }

    const conversation = this.activeConversations.get(callId);
    if (!conversation) {
      throw new Error(`Active conversation for ${callId} not found.`);
    }

    // Run conversational generation and extraction concurrently
    const [conversationResult] = await Promise.all([
      conversation.processCallerUtterance(trimmedText, session),
      extractor
        ? Promise.race([
            extractor.flush(),
            new Promise((resolve) => setTimeout(resolve, 4000)), // timeout safeguard
          ])
        : Promise.resolve(),
    ]);

    const { responseText, toolExecutions } = conversationResult;

    // Add assistant item to transcript
    const assistantItem: TranscriptItem = {
      id: `item_${Date.now()}_assistant`,
      speaker: 'assistant',
      text: responseText,
      timestamp: Date.now(),
      final: true,
    };
    this.sessionManager.addTranscriptItem(callId, assistantItem);

    // 5. Synthesize speech
    let audioBuffer: Buffer | undefined;
    try {
      audioBuffer = await this.ttsProvider.synthesizeSpeech(responseText, {
        voiceId: this.config.voiceId,
        model: this.config.ttsModel,
        format: session.mode === 'phone' ? { container: 'mulaw', sampleRate: 8000 } : { container: 'mp3', sampleRate: 44100 },
        latencyOptimized: true,
      });
    } catch (e: any) {
      console.error('[VoiceAgent] TTS synthesis error:', e.message);
    }

    const liveStructuredData = extractor ? extractor.getCurrentState() : session.structuredData;

    return {
      responseText,
      audioBuffer,
      liveStructuredData,
      escalation: escalationResult,
      toolExecutions,
    };
  }

  /**
   * Completes a call:
   * 1. Flushes parallel extraction queue.
   * 2. Runs final reconciliation pass with schema validation.
   * 3. Generates post-call summary.
   * 4. Persists call session to storage.
   * 5. Optionally dispatches Telegram notification.
   */
  public async endCall(callId: string, status: 'completed' | 'cancelled' | 'failed' = 'completed'): Promise<CallSession> {
    const session = this.sessionManager.getSession(callId);
    if (!session) {
      const stored = await this.storageProvider.getCall(callId);
      if (stored) return stored;
      throw new Error(`Session ${callId} not found.`);
    }

    // 1. Flush parallel extractor
    const extractor = this.activeExtractors.get(callId);
    let currentLiveState = session.structuredData;
    if (extractor) {
      currentLiveState = await extractor.flush();
      this.activeExtractors.delete(callId);
    }
    this.activeConversations.delete(callId);

    // 2. Final reconciliation pass
    const reconciliation = await this.reconciliationEngine.reconcile(
      session.transcript,
      currentLiveState
    );
    session.structuredData = reconciliation.data;

    // 3. Post-call summary generation
    const summary = await this.summaryGenerator.generateSummary(
      session.transcript,
      session.structuredData
    );
    session.summary = summary;

    // 4. Finalize and persist session
    const finalized = await this.sessionManager.finalizeSession(callId, status);

    // 5. Optional Telegram Notification
    if (this.config.telegramNotification?.enabled && this.notificationProvider) {
      try {
        await this.notificationProvider.sendMessage({
          chatId: this.config.telegramNotification.chatId,
          callSession: finalized || session,
          title: `Call Completed: ${session.callerId}`,
          message: summary.rawSummaryText,
          structuredData: summary.extractedStructuredData,
        });
      } catch (err: any) {
        console.error('[VoiceAgent] Failed to send Telegram alert:', err.message);
      }
    }

    return finalized || session;
  }

  // --- Convenience Query Methods ---

  public async getCall(callId: string): Promise<CallSession | null> {
    const active = this.sessionManager.getSession(callId);
    if (active) return active;
    return this.storageProvider.getCall(callId);
  }

  public async getStructuredData(callId: string): Promise<ExtractedDataState | null> {
    const call = await this.getCall(callId);
    return call ? call.structuredData : null;
  }

  public async getTranscript(callId: string): Promise<TranscriptItem[] | null> {
    const call = await this.getCall(callId);
    return call ? call.transcript : null;
  }

  public async getSummary(callId: string): Promise<CallSummary | null> {
    const call = await this.getCall(callId);
    return call?.summary || null;
  }

  public async listCalls(filter?: any): Promise<{ calls: CallSession[]; total: number }> {
    return this.storageProvider.listCalls(filter);
  }

  public async sendTelegramMessage(payload: TelegramNotificationPayload): Promise<boolean> {
    return this.notificationProvider.sendMessage(payload);
  }
}

/**
 * Factory function for creating a Voice Agent instance.
 */
export function createVoiceAgent(config: VoiceAgentConfig): VoiceAgent {
  return new VoiceAgent(config);
}
