/**
 * ToolRegistry — manages tool definitions for the assistant.
 *
 * Each tool has a name, description, JSON Schema parameters, an execute
 * function, and optional confirm flag for destructive operations.
 *
 * Unlike the ISM-specific registry, this is NOT a singleton — each app
 * creates its own instance. There is no built-in ID mapping; use
 * `config.transformParams`/`transformResult` for that.
 */
import type { ToolDefinition } from './types.js';

export class ToolRegistry {
    private _tools = new Map<string, ToolDefinition>();

    /**
     * Register a tool definition.
     * @throws if name or execute is missing.
     */
    register(tool: ToolDefinition): void {
        if (!tool.name || !tool.execute) {
            throw new Error(
                `Tool registration requires 'name' and 'execute': ${JSON.stringify(tool.name)}`,
            );
        }
        this._tools.set(tool.name, {
            name: tool.name,
            description: tool.description || '',
            parameters: tool.parameters || { type: 'object', properties: {} },
            execute: tool.execute,
            confirm: tool.confirm ?? false,
            category: tool.category || 'general',
        });
    }

    /** Unregister a tool by name. */
    unregister(name: string): void {
        this._tools.delete(name);
    }

    /** Get a single tool by name. */
    getTool(name: string): ToolDefinition | null {
        return this._tools.get(name) ?? null;
    }

    /** Get all registered tools. */
    getTools(): ToolDefinition[] {
        return Array.from(this._tools.values());
    }

    /**
     * Get tool schemas in OpenAI function-calling format.
     * Suitable for passing as `tools` in a chat completion request.
     */
    getToolSchemas(): unknown[] {
        return Array.from(this._tools.values()).map((t) => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            },
        }));
    }

    /** Check if a tool requires user confirmation before execution. */
    requiresConfirmation(name: string): boolean {
        return this._tools.get(name)?.confirm ?? false;
    }

    /**
     * Execute a tool by name.
     * @param name - tool name
     * @param params - parsed arguments from the LLM
     * @param context - opaque context from the host app (e.g. store proxy)
     */
    async execute(
        name: string,
        params: Record<string, unknown>,
        context: unknown,
    ): Promise<unknown> {
        const tool = this._tools.get(name);
        if (!tool) {
            return { success: false, error: `Unknown tool: ${name}` };
        }
        try {
            return await tool.execute(params, context);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`Tool '${name}' execution failed:`, err);
            return { success: false, error: message };
        }
    }

    /** Remove all registered tools. */
    clear(): void {
        this._tools.clear();
    }
}