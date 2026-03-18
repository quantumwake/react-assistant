/**
 * OpenAI function-calling adapter.
 *
 * Parses `choices[0].message.tool_calls` and formats `role: "tool"` result messages.
 * This is the canonical wire format — Anthropic responses can be converted to this
 * format on the backend if desired.
 */
import { BaseProviderAdapter } from './BaseProviderAdapter.js';
import type { ParsedResponse, ToolCall, ToolResult } from '../types.js';

interface OpenAIToolCall {
    id: string;
    type: string;
    function: { name: string; arguments: string | Record<string, unknown> };
}

interface OpenAIResponse {
    choices?: Array<{
        message?: {
            role?: string;
            content?: string | null;
            tool_calls?: OpenAIToolCall[];
        };
    }>;
}

export class OpenAIAdapter extends BaseProviderAdapter {
    parseResponse(response: unknown): ParsedResponse {
        const r = response as OpenAIResponse;
        const message = r?.choices?.[0]?.message;
        if (!message) {
            return { content: null, toolCalls: [] };
        }

        const content = message.content || null;
        const toolCalls: ToolCall[] = (message.tool_calls || []).map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: this._parseArguments(tc.function.arguments),
        }));

        return { content, toolCalls };
    }

    formatToolResults(results: ToolResult[]): unknown[] {
        return results.map((tr) => ({
            role: 'tool',
            tool_call_id: tr.id,
            content: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result),
        }));
    }

    formatAssistantToolCallMessage(content: string | null, toolCalls: ToolCall[]): unknown {
        return {
            role: 'assistant',
            content: content || null,
            tool_calls: toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function',
                function: {
                    name: tc.name,
                    arguments:
                        typeof tc.arguments === 'string'
                            ? tc.arguments
                            : JSON.stringify(tc.arguments),
                },
            })),
        };
    }

    private _parseArguments(argsStr: string | Record<string, unknown>): Record<string, unknown> {
        if (!argsStr) return {};
        if (typeof argsStr === 'object') return argsStr;
        try {
            return JSON.parse(argsStr) as Record<string, unknown>;
        } catch {
            console.warn('Failed to parse tool arguments:', argsStr);
            return {};
        }
    }
}
