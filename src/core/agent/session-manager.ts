import { CallSession, CallStatus, CallMode } from '../types/session';
import { TranscriptItem } from '../types/transcript';
import { ExtractedDataState, ExtractionSchema } from '../types/schema';
import { SchemaValidator } from '../extraction/schema-validator';
import { CallStorageProvider } from '../types/providers';

export class SessionManager {
  private activeSessions: Map<string, CallSession> = new Map();
  private storageProvider: CallStorageProvider;
  private schema: ExtractionSchema;

  constructor(storageProvider: CallStorageProvider, schema: ExtractionSchema) {
    this.storageProvider = storageProvider;
    this.schema = schema;
  }

  /**
   * Creates and initializes a new call session.
   */
  public createSession(options: {
    callId: string;
    callerId: string;
    mode: CallMode;
    applicationUserId?: string;
    language?: string;
    metadata?: Record<string, any>;
  }): CallSession {
    const session: CallSession = {
      callId: options.callId,
      callerId: options.callerId,
      applicationUserId: options.applicationUserId,
      startedAt: Date.now(),
      duration: 0,
      status: 'initiating',
      mode: options.mode,
      transcript: [],
      structuredData: SchemaValidator.initializeState(this.schema),
      metadata: options.metadata || {},
      language: options.language || 'en',
    };

    this.activeSessions.set(session.callId, session);
    return session;
  }

  public getSession(callId: string): CallSession | undefined {
    return this.activeSessions.get(callId);
  }

  public getAllActiveSessions(): CallSession[] {
    return Array.from(this.activeSessions.values());
  }

  public updateStatus(callId: string, status: CallStatus, error?: string): void {
    const session = this.activeSessions.get(callId);
    if (!session) return;

    session.status = status;
    if (error) {
      session.error = error;
    }
  }

  public addTranscriptItem(callId: string, item: TranscriptItem): void {
    const session = this.activeSessions.get(callId);
    if (!session) return;

    session.transcript.push(item);
    session.duration = Math.max(0, (Date.now() - session.startedAt) / 1000);
  }

  public updateStructuredData(callId: string, data: ExtractedDataState): void {
    const session = this.activeSessions.get(callId);
    if (!session) return;

    session.structuredData = { ...session.structuredData, ...data };
  }

  /**
   * Finalizes call session: records duration, timestamps, and persists to storage.
   */
  public async finalizeSession(callId: string, status: CallStatus = 'completed'): Promise<CallSession | null> {
    const session = this.activeSessions.get(callId);
    if (!session) return null;

    session.endedAt = Date.now();
    session.duration = Math.max(1, Math.round((session.endedAt - session.startedAt) / 1000));
    session.status = status;

    // Persist call to storage provider
    await this.storageProvider.saveCall(session);

    // Remove from active memory map
    this.activeSessions.delete(callId);

    return session;
  }
}
