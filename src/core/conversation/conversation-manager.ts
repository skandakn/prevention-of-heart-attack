import { LLMProvider, LLMMessage } from '../types/providers';
import { ToolRegistry } from '../tools/tool-registry';
import { TranscriptItem } from '../types/transcript';
import { CallSession } from '../types/session';

export interface ConversationManagerConfig {
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
  systemPrompt: string;
  businessContext?: string;
  greeting: string;
  language?: string;
  maxHistoryTurns?: number;
}

export class ConversationManager {
  private llmProvider: LLMProvider;
  private toolRegistry: ToolRegistry;
  private systemPrompt: string;
  private businessContext: string;
  private greeting: string;
  private language: string;
  private maxHistoryTurns: number;
  private messages: LLMMessage[] = [];
  private isGenerating = false;

  constructor(config: ConversationManagerConfig) {
    this.llmProvider = config.llmProvider;
    this.toolRegistry = config.toolRegistry;
    this.systemPrompt = config.systemPrompt;
    this.businessContext = config.businessContext || '';
    this.greeting = config.greeting;
    this.language = config.language || 'en';
    this.maxHistoryTurns = config.maxHistoryTurns || 10;
  }

  public getGreeting(): string {
    return this.greeting;
  }

  /**
   * Initializes conversation with system instructions and initial greeting.
   */
  public initialize(): { greeting: string; initialItem: TranscriptItem } {
    const greetingItem: TranscriptItem = {
      id: `item_${Date.now()}_greeting`,
      speaker: 'assistant',
      text: this.greeting,
      timestamp: Date.now(),
      final: true,
    };

    this.messages.push({
      role: 'assistant',
      content: this.greeting,
    });

    return {
      greeting: this.greeting,
      initialItem: greetingItem,
    };
  }

  /**
   * Processes a caller's spoken utterance and produces the AI's spoken reply.
   * Also executes tool calls if requested by the LLM.
   */
  public async processCallerUtterance(
    callerText: string,
    session: CallSession
  ): Promise<{ responseText: string; toolExecutions: any[] }> {
    if (!callerText || callerText.trim().length === 0) {
      return { responseText: '', toolExecutions: [] };
    }

    this.isGenerating = true;

    // Append caller message
    this.messages.push({
      role: 'user',
      content: callerText,
    });

    // Prune history to avoid excessive latency (Requirement 30)
    if (this.messages.length > this.maxHistoryTurns * 2) {
      this.messages = this.messages.slice(-this.maxHistoryTurns * 2);
    }

    const currentDateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const currentYear = new Date().getFullYear();

    // Build rich system instruction
    const fullSystemInstruction = `
${this.systemPrompt}

REAL-TIME CALENDAR CONTEXT:
- Today's Date: ${currentDateStr}
- Current Year: ${currentYear}
- When asked about dates, festivals, or holidays for "this year" or "today", always base your answers on the current year ${currentYear}. For example, for 2026, Ganesh Chaturthi begins on September 14, 2026.

BUSINESS / DOMAIN CONTEXT:
${this.businessContext || 'No additional domain context provided.'}

SPOKEN VOICE CONVERSATION RULES:
1. You are on a LIVE VOICE CALL speaking directly to the caller.
2. Respond in spoken ${this.language}.
3. Keep responses VERY CONCISE: 1 to 3 short sentences.
4. Speak naturally as a warm, professional customer care agent.
5. Do NOT output markdown, bullet points, asterisks, or formatting symbols since your text is read aloud by TTS.
6. If executing a tool is helpful to answer the caller's request, call the tool.
`.trim();

    try {
      const tools = this.toolRegistry.getAllTools();

      let llmResponse = await this.llmProvider.generateResponse({
        messages: this.messages,
        systemInstruction: fullSystemInstruction,
        tools: tools.length > 0 ? tools : undefined,
        temperature: 0.6,
      });

      const toolExecutions: any[] = [];

      // Handle function / tool calling loop if requested by LLM
      while (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        for (const toolCall of llmResponse.toolCalls) {
          const toolResult = await this.toolRegistry.executeTool(toolCall, {
            callId: session.callId,
            callerId: session.callerId,
            session,
            timestamp: Date.now(),
          });

          toolExecutions.push(toolResult);

          // Append tool result into LLM context
          this.messages.push({
            role: 'assistant',
            content: `Called tool ${toolCall.name} with arguments: ${JSON.stringify(toolCall.arguments)}`,
          });

          this.messages.push({
            role: 'tool',
            name: toolCall.name,
            toolCallId: toolCall.id,
            content: JSON.stringify(toolResult.result || { error: toolResult.error }),
          });
        }

        // Re-generate response with tool output incorporated
        llmResponse = await this.llmProvider.generateResponse({
          messages: this.messages,
          systemInstruction: fullSystemInstruction,
          temperature: 0.5,
        });
      }

      const responseText = llmResponse.text || 'I understand. How else can I assist you?';

      // Save assistant response to conversation history
      this.messages.push({
        role: 'assistant',
        content: responseText,
      });

      return {
        responseText,
        toolExecutions,
      };
    } finally {
      this.isGenerating = false;
    }
  }

  public getHistory(): LLMMessage[] {
    return [...this.messages];
  }
}
