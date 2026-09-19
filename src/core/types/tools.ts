import { CallSession } from './session';

export interface ToolExecutionContext {
  callId: string;
  callerId: string;
  session?: CallSession;
  timestamp: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: Record<string, any>, context: ToolExecutionContext) => Promise<any>;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolCallResult {
  id: string;
  name: string;
  result: any;
  error?: string;
  executionTimeMs: number;
}
