import { CallSummary } from '../types/session';
import { TranscriptItem } from '../types/transcript';
import { ExtractedDataState } from '../types/schema';
import { LLMProvider } from '../types/providers';

export class SummaryGenerator {
  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  public async generateSummary(
    transcript: TranscriptItem[],
    structuredData: ExtractedDataState
  ): Promise<CallSummary> {
    if (transcript.length === 0) {
      return {
        reasonForCall: 'Empty session',
        keyInformationProvided: [],
        extractedStructuredData: {},
        actionsTaken: [],
        recommendations: [],
        unresolvedIssues: [],
        escalationStatus: 'none',
        importantFollowUpItems: [],
        rawSummaryText: 'No conversation recorded for this call.',
        generatedAt: Date.now(),
      };
    }

    const cleanStructuredData: Record<string, any> = {};
    for (const [k, v] of Object.entries(structuredData)) {
      if (v.value !== null && v.value !== undefined && v.status !== 'unknown') {
        cleanStructuredData[k] = v.value;
      }
    }

    try {
      const summaryResult = await this.llmProvider.generateSummary(transcript, structuredData);

      return {
        ...summaryResult,
        extractedStructuredData: cleanStructuredData,
        generatedAt: Date.now(),
      };
    } catch (err: any) {
      console.error('[SummaryGenerator] Failed to generate AI summary:', err.message);
      return {
        reasonForCall: 'Inquiry processing',
        keyInformationProvided: transcript
          .filter((t) => t.speaker === 'caller')
          .slice(0, 3)
          .map((t) => t.text),
        extractedStructuredData: cleanStructuredData,
        actionsTaken: ['Session archived'],
        recommendations: [],
        unresolvedIssues: [],
        escalationStatus: 'none',
        importantFollowUpItems: [],
        rawSummaryText: 'Automated fallback summary: Call completed.',
        generatedAt: Date.now(),
      };
    }
  }
}
