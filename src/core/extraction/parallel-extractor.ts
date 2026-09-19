import { ExtractionSchema, ExtractedDataState } from '../types/schema';
import { LLMProvider } from '../types/providers';
import { SchemaValidator } from './schema-validator';

export type ExtractionUpdateListener = (state: ExtractedDataState, delta: Record<string, any>) => void;

export class ParallelExtractor {
  private schema: ExtractionSchema;
  private llmProvider: LLMProvider;
  private currentState: ExtractedDataState;
  private isProcessing = false;
  private utteranceQueue: string[] = [];
  private listeners: ExtractionUpdateListener[] = [];

  constructor(schema: ExtractionSchema, llmProvider: LLMProvider, initialState?: ExtractedDataState) {
    this.schema = schema;
    this.llmProvider = llmProvider;
    this.currentState = initialState || SchemaValidator.initializeState(schema);
  }

  public onUpdate(listener: ExtractionUpdateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getCurrentState(): ExtractedDataState {
    return { ...this.currentState };
  }

  private static readonly PLEASANTRIES = new Set([
    'hi',
    'hello',
    'hey',
    'how are you',
    'how are you?',
    'what is your name',
    'what is your name?',
    'okay',
    'ok',
    'yes',
    'no',
    'sure',
    'thanks',
    'thank you',
    'can you hear me',
    'can you hear me?',
    'good morning',
    'good afternoon',
    'good evening',
  ]);

  /**
   * Non-blocking entry point: queues utterance and triggers background extraction pass.
   * Filters out trivial pleasantries to preserve Gemini API quota.
   */
  public enqueueUtterance(utterance: string): void {
    if (!utterance || utterance.trim().length === 0) return;

    const trimmed = utterance.trim();
    const normalized = trimmed.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

    // Skip extraction API calls for trivial pleasantries with zero data content
    if (ParallelExtractor.PLEASANTRIES.has(normalized) || normalized.split(' ').length < 2) {
      if (process.env.DEBUG_LOGGING === 'true') {
        console.log(`[ParallelExtractor] Skipping extraction for pleasantry: "${trimmed}"`);
      }
      return;
    }

    this.utteranceQueue.push(trimmed);
    // Fire and forget background worker
    this.processQueue().catch((err) => {
      if (process.env.DEBUG_LOGGING === 'true') {
        console.error('[ParallelExtractor] Background extraction error:', err.message);
      }
    });
  }

  /**
   * Synchronous flush for tests or end-of-call: waits for all queued extraction passes to settle.
   */
  public async flush(): Promise<ExtractedDataState> {
    while (this.utteranceQueue.length > 0 || this.isProcessing) {
      await new Promise((res) => setTimeout(res, 30));
    }
    return this.getCurrentState();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.utteranceQueue.length > 0) {
        // Collect current batch of utterances
        const utterances = [...this.utteranceQueue];
        this.utteranceQueue = [];
        const combinedText = utterances.join(' ');

        const previousState = { ...this.currentState };
        const newState = await this.llmProvider.extractStructuredData(
          combinedText,
          this.currentState,
          this.schema
        );

        // Compute delta
        const delta: Record<string, any> = {};
        for (const [key, fieldState] of Object.entries(newState)) {
          if (
            !previousState[key] ||
            previousState[key].value !== fieldState.value ||
            previousState[key].status !== fieldState.status
          ) {
            delta[key] = fieldState.value;
          }
        }

        this.currentState = newState;

        // Notify listeners of live updates
        if (Object.keys(delta).length > 0) {
          for (const listener of this.listeners) {
            try {
              listener(this.currentState, delta);
            } catch (err) {
              console.error('[ParallelExtractor] Listener notification failed:', err);
            }
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
