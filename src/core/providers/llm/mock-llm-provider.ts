import {
  LLMProvider,
  LLMGenerateOptions,
  LLMResponse,
} from '../../types/providers';
import { TranscriptItem } from '../../types/transcript';
import {
  ExtractedDataState,
  ExtractionSchema,
} from '../../types/schema';
import { SchemaValidator } from '../../extraction/schema-validator';

export class MockLLMProvider implements LLMProvider {
  public readonly name = 'MockLLM';
  public cannedResponses: string[] = [];
  public customExtractor?: (
    text: string,
    current: ExtractedDataState,
    schema: ExtractionSchema
  ) => ExtractedDataState;

  constructor(responses: string[] = []) {
    this.cannedResponses = [...responses];
  }

  public async generateResponse(options: LLMGenerateOptions): Promise<LLMResponse> {
    const lastUserMsg = [...options.messages].reverse().find((m) => m.role === 'user');
    const userText = lastUserMsg?.content || '';

    // If caller triggers a tool test
    if (userText.toLowerCase().includes('check account') && options.tools?.some(t => t.name === 'check_account_status')) {
      return {
        text: 'Checking your account right now.',
        toolCalls: [
          {
            id: 'mock_tool_1',
            name: 'check_account_status',
            arguments: { account_id: 'ACC_12345' },
          },
        ],
      };
    }

    if (this.cannedResponses.length > 0) {
      return { text: this.cannedResponses.shift()! };
    }

    // Default conversational responses
    if (userText.toLowerCase().includes('500 litres') || userText.toLowerCase().includes('500 liters')) {
      return { text: 'I have noted your usage of 500 litres per day. Which city or location are you calling from?' };
    }

    if (userText.toLowerCase().includes('bengaluru') || userText.toLowerCase().includes('bangalore')) {
      return { text: 'Thank you for providing your location as Bengaluru. Is there anything else I can help you with?' };
    }

    return { text: `Hello! I understand: "${userText}". How can I assist you today?` };
  }

  public async extractStructuredData(
    transcriptText: string,
    currentData: ExtractedDataState,
    schema: ExtractionSchema
  ): Promise<ExtractedDataState> {
    if (this.customExtractor) {
      return this.customExtractor(transcriptText, currentData, schema);
    }

    const updatedState = { ...currentData };
    const lowerText = transcriptText.toLowerCase();

    // Built-in rule-based deterministic mock extraction for standard test cases
    for (const field of schema.fields) {
      if (field.name === 'daily_usage' || field.name === 'water_usage_liters_per_day') {
        const match = lowerText.match(/(\d+)\s*(litres|liters|l|units)/i) || lowerText.match(/around\s*(\d+)/i) || lowerText.match(/use\s*(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          const validation = SchemaValidator.validateAndCoerce(field, num);
          if (validation.valid) {
            updatedState[field.name] = {
              value: validation.value,
              status: 'explicit',
              confidence: 0.98,
              source: 'caller',
              rawQuote: match[0],
              updatedAt: Date.now(),
            };
          }
        }
      }

      if (field.name === 'location' || field.name === 'city') {
        if (lowerText.includes('bengaluru') || lowerText.includes('bangalore')) {
          updatedState[field.name] = {
            value: 'Bengaluru',
            status: 'explicit',
            confidence: 0.99,
            source: 'caller',
            rawQuote: 'Bengaluru',
            updatedAt: Date.now(),
          };
        } else if (lowerText.includes('delhi')) {
          updatedState[field.name] = {
            value: 'Delhi',
            status: 'explicit',
            confidence: 0.99,
            source: 'caller',
            rawQuote: 'Delhi',
            updatedAt: Date.now(),
          };
        } else if (lowerText.includes('mumbai')) {
          updatedState[field.name] = {
            value: 'Mumbai',
            status: 'explicit',
            confidence: 0.99,
            source: 'caller',
            rawQuote: 'Mumbai',
            updatedAt: Date.now(),
          };
        }
      }
    }

    return updatedState;
  }

  public async reconcileFinalData(
    fullTranscript: TranscriptItem[],
    currentData: ExtractedDataState,
    schema: ExtractionSchema
  ): Promise<{ data: ExtractedDataState; notes?: string }> {
    let reconciled = { ...currentData };
    // Process full transcript chronologically
    for (const item of fullTranscript) {
      if (item.speaker === 'caller') {
        reconciled = await this.extractStructuredData(item.text, reconciled, schema);
      }
    }
    return {
      data: reconciled,
      notes: 'Mock reconciliation completed based on full transcript.',
    };
  }

  public async generateSummary(
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
  }> {
    const callerItems = transcript.filter((t) => t.speaker === 'caller').map((t) => t.text);
    return {
      reasonForCall: callerItems[0] || 'Customer inquiry',
      keyInformationProvided: callerItems.slice(0, 3),
      actionsTaken: ['Recorded caller requirements', 'Extracted structured data'],
      recommendations: ['Follow up with automated report'],
      unresolvedIssues: [],
      escalationStatus: 'none',
      importantFollowUpItems: ['Review verified extraction attributes'],
      rawSummaryText: `Caller participated in an inquiry session. ${callerItems.length} caller messages received.`,
    };
  }
}
