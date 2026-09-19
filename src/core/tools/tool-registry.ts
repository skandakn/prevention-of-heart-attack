import {
  ToolDefinition,
  ToolExecutionContext,
  ToolCallRequest,
  ToolCallResult,
} from '../types/tools';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(initialTools: ToolDefinition[] = []) {
    for (const tool of initialTools) {
      this.registerTool(tool);
    }
  }

  /**
   * Registers a domain-agnostic tool definition.
   */
  public registerTool(tool: ToolDefinition): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid string name.');
    }
    if (!tool.execute || typeof tool.execute !== 'function') {
      throw new Error(`Tool '${tool.name}' must have an execute function.`);
    }
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Executes a tool request safely with parameter validation and timing.
   */
  public async executeTool(
    request: ToolCallRequest,
    context: ToolExecutionContext
  ): Promise<ToolCallResult> {
    const startTime = Date.now();
    const tool = this.tools.get(request.name);

    if (!tool) {
      return {
        id: request.id,
        name: request.name,
        result: null,
        error: `Tool '${request.name}' is not registered in the tool registry.`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      // Validate required parameters
      const required = tool.parameters.required || [];
      const args = request.arguments || {};
      for (const req of required) {
        if (args[req] === undefined || args[req] === null) {
          throw new Error(`Missing required parameter: '${req}' for tool '${tool.name}'`);
        }
      }

      // Execute safely
      const result = await tool.execute(args, context);
      const executionTimeMs = Date.now() - startTime;

      if (process.env.DEBUG_LOGGING === 'true') {
        console.log(`[ToolRegistry] Executed '${tool.name}' in ${executionTimeMs}ms:`, {
          args,
          result,
        });
      }

      return {
        id: request.id,
        name: tool.name,
        result,
        executionTimeMs,
      };
    } catch (err: any) {
      const executionTimeMs = Date.now() - startTime;
      console.error(`[ToolRegistry] Error executing '${tool.name}':`, err.message);
      return {
        id: request.id,
        name: tool.name,
        result: null,
        error: err.message,
        executionTimeMs,
      };
    }
  }
}
