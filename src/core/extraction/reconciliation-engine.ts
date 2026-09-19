import { ExtractionSchema, ExtractedDataState, ExtractionResult } from '../types/schema';
import { TranscriptItem } from '../types/transcript';
import { LLMProvider } from '../types/providers';
import { SchemaValidator } from './schema-validator';

export class ReconciliationEngine {
  private schema: ExtractionSchema;
  private llmProvider: LLMProvider;

  constructor(schema: ExtractionSchema, llmProvider: LLMProvider) {
    this.schema = schema;
    this.llmProvider = llmProvider;
  }

  /**
   * Executes the final end-of-call reconciliation pass.
   */
  public async reconcile(
    fullTranscript: TranscriptItem[],
    liveExtractionState: ExtractedDataState
  ): Promise<ExtractionResult> {
    if (fullTranscript.length === 0) {
      return {
        data: liveExtractionState,
        unresolvedConflicts: [],
        completedAt: Date.now(),
      };
    }

    const { data: reconciledData, notes } = await this.llmProvider.reconcileFinalData(
      fullTranscript,
      liveExtractionState,
      this.schema
    );

    const finalData: ExtractedDataState = {};
    const unresolvedConflicts: string[] = [];

    // Rigorous type validation and post-processing
    for (const field of this.schema.fields) {
      const current = reconciledData[field.name];

      if (!current || current.value === null || current.value === undefined) {
        finalData[field.name] = {
          value: field.default !== undefined ? field.default : null,
          status: 'unknown',
          confidence: 0.0,
          source: 'system',
          updatedAt: Date.now(),
        };
      } else {
        const validation = SchemaValidator.validateAndCoerce(field, current.value);

        if (validation.valid) {
          finalData[field.name] = {
            ...current,
            value: validation.value,
            updatedAt: Date.now(),
          };

          if (current.status === 'conflict') {
            unresolvedConflicts.push(field.name);
          }
        } else {
          // Type violation: mark as conflict/unknown rather than corrupting data
          finalData[field.name] = {
            value: null,
            status: 'conflict',
            confidence: 0.2,
            source: current.source || 'caller',
            conflictValues: [current.value],
            rawQuote: current.rawQuote,
            updatedAt: Date.now(),
          };
          unresolvedConflicts.push(field.name);
        }
      }
    }

    return {
      data: finalData,
      unresolvedConflicts,
      reconciliationNotes: notes,
      completedAt: Date.now(),
    };
  }
}
