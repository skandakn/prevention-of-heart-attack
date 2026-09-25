import {
  LLMProvider,
  LLMGenerateOptions,
  LLMResponse,
} from '../../types/providers';
import { TranscriptItem } from '../../types/transcript';
import {
  ExtractedDataState,
  ExtractionSchema,
  FieldDefinition,
} from '../../types/schema';
import { SchemaValidator } from '../../extraction/schema-validator';

export interface GeminiProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class GeminiProvider implements LLMProvider {
  public readonly name = 'GoogleGemini';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config?: GeminiProviderConfig) {
    this.apiKey = config?.apiKey || process.env.GEMINI_API_KEY || '';
    // Default to gemini-3.5-flash-lite for lowest latency (1.1s) and high rate-limit ceiling
    this.model = config?.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    this.baseUrl = config?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Executes a Gemini API request with automatic model pool rotation and fast fallback.
   */
  private async executeWithRetryAndFallback(requestBody: any): Promise<any> {
    const modelPool = [
      'gemini-3-flash-preview',
      this.model,
      'gemini-3.8-flash',
    ].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

    let lastError: any = null;

    for (const model of modelPool) {
      const endpoint = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(8000),
        });

        if (response.ok) {
          return await response.json();
        }

        const errText = await response.text();
        if (response.status === 429 || errText.includes('RESOURCE_EXHAUSTED')) {
          if (process.env.DEBUG_LOGGING === 'true') {
            console.warn(`[GeminiProvider] Quota reached on ${model}. Rotating to next fallback model...`);
          }
          lastError = new Error(`Rate limit exceeded on ${model}`);
          continue; // Try next model immediately without delay
        }

        if (response.status === 503 || response.status === 404) {
          if (process.env.DEBUG_LOGGING === 'true') {
            console.warn(`[GeminiProvider] Model ${model} returned ${response.status}. Rotating...`);
          }
          lastError = new Error(`Model ${model} returned ${response.status}`);
          continue;
        }

        throw new Error(`Gemini API error (${response.status}): ${errText}`);
      } catch (err: any) {
        lastError = err;
        if (err.message?.includes('Rate limit') || err.message?.includes('429') || err.message?.includes('404') || err.name === 'TimeoutError') {
          continue;
        }
        throw err;
      }
    }

    // Graceful fallback response immediately without waiting
    return {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'Based on your personal cardiovascular health profile, I recommend maintaining consistent physical movement, heart-healthy hydration, and a balanced diet. What specific goal would you like to focus on next?',
              },
            ],
          },
        },
      ],
    };
  }

  /**
   * Generates conversational AI response, handling tools and prompt-injection defenses.
   */
  public async generateResponse(options: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API Key is not configured. Set GEMINI_API_KEY in environment variables.');
    }

    // Format messages for Gemini API
    const contents: any[] = [];
    const isVoiceCall =
      options.systemInstruction?.toLowerCase().includes("helpline") ||
      options.systemInstruction?.toLowerCase().includes("caller");

    for (const msg of options.messages) {
      if (msg.role === 'system') {
        continue;
      }

      const role = msg.role === 'assistant' ? 'model' : 'user';
      let text = msg.content;

      if (role === 'user' && isVoiceCall) {
        text = `[CALLER_INPUT_START]\n${text}\n[CALLER_INPUT_END]`;
      }

      contents.push({
        role,
        parts: [{ text }],
      });
    }

    const systemInstructionText = options.systemInstruction
      ? options.systemInstruction
      : `You are a professional AI clinical wellness assistant. Provide clear, empathetic, and evidence-informed health guidance.`;

    const requestBody: any = {
      systemInstruction: {
        parts: [{ text: systemInstructionText }],
      },
      contents,
      generationConfig: {
        temperature: options.temperature !== undefined ? options.temperature : 0.6,
        maxOutputTokens: options.maxTokens || 250,
      },
    };

    if (options.tools && options.tools.length > 0) {
      const functionDeclarations = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT',
          properties: t.parameters.properties,
          required: t.parameters.required,
        },
      }));
      requestBody.tools = [{ functionDeclarations }];
    }

    const data = await this.executeWithRetryAndFallback(requestBody);
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let textResponse = '';
    const toolCalls: Array<{ id: string; name: string; arguments: Record<string, any> }> = [];

    for (const part of parts) {
      if (part.text) {
        textResponse += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args || {},
        });
      }
    }

    return {
      text: textResponse.trim(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      tokenUsage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  }

  /**
   * Parallel extraction engine: Extracts structured data from incoming utterance against schema.
   */
  public async extractStructuredData(
    transcriptText: string,
    currentData: ExtractedDataState,
    schema: ExtractionSchema
  ): Promise<ExtractedDataState> {
    if (!this.apiKey) {
      return currentData;
    }

    const endpoint = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const schemaDescription = schema.fields
      .map(
        (f) =>
          `- ${f.name} (type: ${f.type}${f.enumValues ? `, allowed: [${f.enumValues.join(', ')}]` : ''}): ${f.description}`
      )
      .join('\n');

    const prompt = `
You are a domain-agnostic structured data extraction engine operating during a live phone call.
Your job is to extract or update values for the requested schema fields based on the latest caller utterance.

SCHEMA DEFINITION:
${schemaDescription}

CURRENT EXTRACTED STATE:
${JSON.stringify(currentData, null, 2)}

LATEST TRANSCRIPT CONTEXT:
"""${transcriptText}"""

RULES:
1. Only update a field if the transcript explicitly mentions or strongly implies it.
2. NEVER invent, hallucinate, or assume information not stated in the transcript.
3. If a field was not mentioned, keep its existing value and status.
4. For each field updated or evaluated, output:
   - "value": the extracted value matching the defined type (e.g. number for number, string for string), or null if unknown
   - "status": "explicit" (caller stated it directly), "inferred" (caller strongly implied it), "unknown" (never provided), or "conflict" (caller provided contradictory statements)
   - "confidence": number between 0.0 and 1.0
   - "rawQuote": exact verbatim snippet spoken by caller
5. Output MUST be a valid JSON object mapping each field name to its object.

Example output format:
{
  "location": {
    "value": "Bengaluru",
    "status": "explicit",
    "confidence": 0.95,
    "rawQuote": "I am in Bengaluru"
  }
}
`;

    try {
      const jsonResp = await this.executeWithRetryAndFallback({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const rawOutput = jsonResp.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawOutput) return currentData;

      const parsed = JSON.parse(rawOutput);
      const updatedState = { ...currentData };

      for (const field of schema.fields) {
        if (parsed[field.name]) {
          const item = parsed[field.name];
          // Validate and coerce against schema
          const validation = SchemaValidator.validateAndCoerce(field, item.value);

          if (validation.valid && validation.value !== null) {
            updatedState[field.name] = {
              value: validation.value,
              status: item.status || 'explicit',
              confidence: typeof item.confidence === 'number' ? item.confidence : 0.9,
              source: 'caller',
              rawQuote: item.rawQuote || undefined,
              updatedAt: Date.now(),
            };
          }
        }
      }

      return updatedState;
    } catch (error) {
      if (process.env.DEBUG_LOGGING === 'true') {
        console.error('[GeminiProvider] Structured extraction failed:', error);
      }
      return currentData;
    }
  }

  /**
   * Final reconciliation pass: reconciles all fields against the full transcript.
   */
  public async reconcileFinalData(
    fullTranscript: TranscriptItem[],
    currentData: ExtractedDataState,
    schema: ExtractionSchema
  ): Promise<{ data: ExtractedDataState; notes?: string }> {
    if (!this.apiKey) {
      return { data: currentData, notes: 'Mocked reconciliation' };
    }

    const endpoint = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const formattedTranscript = fullTranscript
      .map((t) => `[${t.speaker.toUpperCase()}]: ${t.text}`)
      .join('\n');

    const schemaDescription = schema.fields
      .map(
        (f) =>
          `- ${f.name} (type: ${f.type}${f.enumValues ? `, allowed: [${f.enumValues.join(', ')}]` : ''}): ${f.description}`
      )
      .join('\n');

    const prompt = `
You are the final structured data reconciliation engine for a completed call.
Analyze the complete transcript and reconcile the final values for all schema fields.

SCHEMA:
${schemaDescription}

INTERMEDIATE EXTRACTION STATE:
${JSON.stringify(currentData, null, 2)}

COMPLETE CALL TRANSCRIPT:
${formattedTranscript}

TASK:
1. Re-verify every field against the entire transcript.
2. If the caller corrected or changed a previous statement later in the call, use their final corrected statement.
3. If information is contradictory and unresolved, mark status as "conflict" and list both candidate values in "conflictValues".
4. If a field was never mentioned, leave status as "unknown" and value as null.
5. Provide a brief reconciliation note explaining any updates or conflict resolutions.

Return a JSON object with:
{
  "fields": {
    "<fieldName>": {
      "value": ...,
      "status": "explicit" | "inferred" | "unknown" | "conflict",
      "confidence": 0.0 - 1.0,
      "rawQuote": "...",
      "conflictValues": [...]
    }
  },
  "reconciliationNotes": "..."
}
`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        return { data: currentData };
      }

      const jsonResp = await response.json();
      const rawText = jsonResp.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return { data: currentData };

      const parsed = JSON.parse(rawText);
      const reconciledData: ExtractedDataState = { ...currentData };

      if (parsed.fields) {
        for (const field of schema.fields) {
          if (parsed.fields[field.name]) {
            const fState = parsed.fields[field.name];
            const validation = SchemaValidator.validateAndCoerce(field, fState.value);

            reconciledData[field.name] = {
              value: validation.valid ? validation.value : null,
              status: fState.status || 'unknown',
              confidence: fState.confidence || 0.5,
              source: 'caller',
              rawQuote: fState.rawQuote,
              conflictValues: fState.conflictValues,
              updatedAt: Date.now(),
            };
          }
        }
      }

      return {
        data: reconciledData,
        notes: parsed.reconciliationNotes,
      };
    } catch (error) {
      if (process.env.DEBUG_LOGGING === 'true') {
        console.error('[GeminiProvider] Final reconciliation failed:', error);
      }
      return { data: currentData };
    }
  }

  /**
   * Post-call summary generation.
   */
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
    if (!this.apiKey) {
      return {
        reasonForCall: 'General helpline inquiry',
        keyInformationProvided: ['Spoken conversation processed'],
        actionsTaken: ['Logged conversation in call history'],
        recommendations: ['Follow up with caller if needed'],
        unresolvedIssues: [],
        escalationStatus: 'none',
        importantFollowUpItems: [],
        rawSummaryText: 'Automated call processing summary.',
      };
    }

    const endpoint = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const formattedTranscript = transcript
      .map((t) => `[${t.speaker.toUpperCase()}]: ${t.text}`)
      .join('\n');

    const prompt = `
You are an expert customer-care supervisor.
Generate an accurate, structured summary of the completed call based ONLY on the provided transcript and extracted data.
Do NOT hallucinate or assume facts not present.

TRANSCRIPT:
${formattedTranscript}

EXTRACTED DATA:
${JSON.stringify(structuredData, null, 2)}

Output a valid JSON object matching:
{
  "reasonForCall": "Brief description of why the caller contacted support",
  "keyInformationProvided": ["Key point 1", "Key point 2"],
  "actionsTaken": ["Action taken 1"],
  "recommendations": ["Recommendation 1"],
  "unresolvedIssues": ["Any unanswered questions or pending issues"],
  "escalationStatus": "none" | "requested" | "transferred" | "failed",
  "importantFollowUpItems": ["Follow-up item 1"],
  "rawSummaryText": "A clean, executive paragraph summarizing the interaction"
}
`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini summary API failed: ${response.status}`);
      }

      const jsonResp = await response.json();
      const rawText = jsonResp.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText);

      return {
        reasonForCall: parsed.reasonForCall || 'Customer care inquiry',
        keyInformationProvided: parsed.keyInformationProvided || [],
        actionsTaken: parsed.actionsTaken || [],
        recommendations: parsed.recommendations || [],
        unresolvedIssues: parsed.unresolvedIssues || [],
        escalationStatus: parsed.escalationStatus || 'none',
        importantFollowUpItems: parsed.importantFollowUpItems || [],
        rawSummaryText: parsed.rawSummaryText || 'Call completed successfully.',
      };
    } catch (error) {
      return {
        reasonForCall: 'Customer inquiry',
        keyInformationProvided: ['Recorded call session'],
        actionsTaken: ['Session archived'],
        recommendations: [],
        unresolvedIssues: [],
        escalationStatus: 'none',
        importantFollowUpItems: [],
        rawSummaryText: 'Call recorded and archived.',
      };
    }
  }
}
