export type FieldDataType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum'
  | 'date'
  | 'datetime'
  | 'array'
  | 'object';

export interface FieldDefinition {
  name: string;
  type: FieldDataType;
  description: string;
  required?: boolean;
  enumValues?: string[];
  itemType?: FieldDataType; // If type is 'array'
  properties?: FieldDefinition[]; // If type is 'object'
  default?: any;
}

export interface ExtractionSchema {
  name?: string;
  description?: string;
  fields: FieldDefinition[];
}

export type ExtractionStatus = 'explicit' | 'inferred' | 'unknown' | 'conflict';

export interface ExtractedFieldState<T = any> {
  value: T | null;
  status: ExtractionStatus;
  confidence: number; // 0.0 to 1.0
  source: 'caller' | 'assistant' | 'system';
  rawQuote?: string; // Direct quote from transcript supporting this extraction
  conflictValues?: any[]; // Conflicting candidate values if status === 'conflict'
  updatedAt: number;
}

export type ExtractedDataState = Record<string, ExtractedFieldState>;

export interface ExtractionResult {
  data: ExtractedDataState;
  unresolvedConflicts: string[];
  reconciliationNotes?: string;
  completedAt: number;
}
