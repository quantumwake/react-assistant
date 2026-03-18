/**
 * Base provider adapter — abstract class implementing the ProviderAdapter interface.
 *
 * Subclasses convert between the neutral format used by the ToolRegistry
 * and the specific format expected by an LLM provider (OpenAI, Anthropic).
 */
import type { ProviderAdapter, ParsedResponse, ToolCall, ToolResult } from '../types.js';

export abstract class BaseProviderAdapter implements ProviderAdapter {
    abstract parseResponse(response: unknown): ParsedResponse;
    abstract formatToolResults(results: ToolResult[]): unknown[];
    abstract formatAssistantToolCallMessage(
        content: string | null,
        toolCalls: ToolCall[],
    ): unknown;
}
