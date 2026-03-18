/**
 * Anthropic Messages API adapter.
 *
 * Parses `content[].type=tool_use` blocks and formats `tool_result` content blocks.
 * Use this when the backend returns raw Anthropic responses without converting
 * to OpenAI format.
 */
import { BaseProviderAdapter } from './BaseProviderAdapter.js';
import type { ParsedResponse, ToolCall, ToolResult } from '../types.js';

interface AnthropicContentBlock {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
}

interface AnthropicResponse {
    content?: AnthropicContentBlock[];
    stop_reason?: string;
}

export class AnthropicAdapter extends BaseProviderAdapter {
    parseResponse(response: unknown): ParsedResponse {
        const r = response as AnthropicResponse;
        const contentBlocks = r?.content || [];

        const textParts = contentBlocks
            .filter((c) => c.type === 'text')
            .map((c) => c.text || '')
            .join('');

        const toolCalls: ToolCall[] = contentBlocks
            .filter((c) => c.type === 'tool_use')
            .map((tc) => ({
                id: tc.id!,
                name: tc.name!,
                arguments: tc.input || {},
            }));

        return { content: textParts || null, toolCalls };
    }

    formatToolResults(results: ToolResult[]): unknown[] {
        // Anthropic expects tool results as a single user message with tool_result content blocks
        return [
            {
                role: 'user',
                content: results.map((tr) => ({
                    type: 'tool_result',
                    tool_use_id: tr.id,
                    content:
                        typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result),
                })),
            },
        ];
    }

    formatAssistantToolCallMessage(content: string | null, toolCalls: ToolCall[]): unknown {
        const parts: unknown[] = [];
        if (content) {
            parts.push({ type: 'text', text: content });
        }
        for (const tc of toolCalls) {
            parts.push({
                type: 'tool_use',
                id: tc.id,
                name: tc.name,
                input: tc.arguments,
            });
        }
        return { role: 'assistant', content: parts };
    }
}
