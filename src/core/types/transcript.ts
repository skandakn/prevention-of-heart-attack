export type SpeakerRole = 'caller' | 'assistant' | 'system';

export interface TranscriptItem {
  id: string;
  speaker: SpeakerRole;
  text: string;
  timestamp: number; // Unix timestamp in milliseconds
  final: boolean;
  confidence?: number;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export interface ConversationTurn {
  turnId: string;
  callerUtterance?: TranscriptItem;
  assistantUtterance?: TranscriptItem;
  extractedDelta?: Record<string, any>;
  timestamp: number;
}
