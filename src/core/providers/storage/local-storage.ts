import fs from 'fs';
import path from 'path';
import { CallStorageProvider } from '../../types/providers';
import { CallSession } from '../../types/session';

export class LocalStorageProvider implements CallStorageProvider {
  public readonly name = 'LocalStorage';
  private storageDir: string;
  private cache: Map<string, CallSession> = new Map();
  private initialized = false;

  constructor(storageDir?: string) {
    const isVercel = Boolean(process.env.VERCEL);
    this.storageDir = storageDir || process.env.STORAGE_DIR || (isVercel ? '/tmp/calls' : './data/calls');
    try {
      this.ensureDirectoryExists();
    } catch {
      // Fallback to /tmp if primary directory is not writable (e.g. read-only filesystem)
      this.storageDir = '/tmp/calls';
      this.ensureDirectoryExists();
    }
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadAllIntoCache(): void {
    if (this.initialized) return;
    this.ensureDirectoryExists();

    try {
      const files = fs.readdirSync(this.storageDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(this.storageDir, file), 'utf-8');
            const session = JSON.parse(raw) as CallSession;
            if (session.callId) {
              this.cache.set(session.callId, session);
            }
          } catch (e) {
            // Ignore corrupted individual files
          }
        }
      }
    } catch (e) {
      // Directory empty or inaccessible
    }

    this.initialized = true;
  }

  public async saveCall(session: CallSession): Promise<void> {
    this.loadAllIntoCache();
    this.cache.set(session.callId, session);

    this.ensureDirectoryExists();
    const filePath = path.join(this.storageDir, `${session.callId}.json`);

    try {
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
    } catch (error: any) {
      console.error(`[LocalStorageProvider] Failed to persist call ${session.callId}:`, error.message);
    }
  }

  public async getCall(callId: string): Promise<CallSession | null> {
    this.loadAllIntoCache();
    const session = this.cache.get(callId);
    if (session) return session;

    // Attempt direct disk read fallback
    const filePath = path.join(this.storageDir, `${callId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const loaded = JSON.parse(raw) as CallSession;
        this.cache.set(callId, loaded);
        return loaded;
      } catch {
        return null;
      }
    }

    return null;
  }

  public async listCalls(filter?: {
    status?: string;
    mode?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ calls: CallSession[]; total: number }> {
    this.loadAllIntoCache();
    let all = Array.from(this.cache.values());

    // Sort descending by startedAt
    all.sort((a, b) => b.startedAt - a.startedAt);

    if (filter?.status) {
      all = all.filter((c) => c.status === filter.status);
    }
    if (filter?.mode) {
      all = all.filter((c) => c.mode === filter.mode);
    }

    const total = all.length;
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 50;
    const paginated = all.slice(offset, offset + limit);

    return {
      calls: paginated,
      total,
    };
  }

  public async deleteCall(callId: string): Promise<boolean> {
    this.loadAllIntoCache();
    this.cache.delete(callId);

    const filePath = path.join(this.storageDir, `${callId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}
