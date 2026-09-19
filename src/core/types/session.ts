import { TranscriptItem } from './transcript';
import { ExtractedDataState } from './schema';

export type CallStatus =
  | 'initiating'
  | 'active'
  | 'completed'
  | 'failed'
  | 'transferred'
  | 'cancelled';

export type CallMode = 'phone' | 'browser';

export interface CallSummary {
  reasonForCall: string;
  keyInformationProvided: string[];
  extractedStructuredData: Record<string, any>;
  actionsTaken: string[];
  recommendations: string[];
  unresolvedIssues: string[];
  escalationStatus: 'none' | 'requested' | 'transferred' | 'failed';
  importantFollowUpItems: string[];
  rawSummaryText: string;
  generatedAt: number;
}

export interface CallSession {
  callId: string;
  callerId: string;
  applicationUserId?: string;
  startedAt: number;
  endedAt?: number;
  duration: number; // in seconds
  status: CallStatus;
  mode: CallMode;
  transcript: TranscriptItem[];
  summary?: CallSummary;
  structuredData: ExtractedDataState;
  metadata: Record<string, any>;
  error?: string;
  language: string;
}

export interface SessionStats {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
  failedCalls: number;
  avgDurationSeconds: number;
  modeDistribution: {
    phone: number;
    browser: number;
  };
}
