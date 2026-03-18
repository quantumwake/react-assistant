/**
 * useAssistant — core hook implementing the agentic tool-calling loop.
 *
 * Manages conversation state, LLM calls, tool execution, confirmation gates,
 * auto-summarization, and debug mode. This is the engine of the assistant.
 *
 * Not meant to be used directly — use AssistantProvider + useAssistantContext() instead.
 */
import { useCallback, useRef, useState } from 'react';
import { OpenAIAdapter } from './providers/OpenAIAdapter.js';
import { AnthropicAdapter } from './providers/AnthropicAdapter.js';
import type {
    AssistantConfig,
    CompletionRequest,
    DisplayMessage,
    ToolCallMessage,
    PendingConfirmation,
    DebugPayload,
    ProviderAdapter,
    ToolCall,
} from './types.js';
import type { ToolRegistry } from './ToolRegistry.js';

// Summarization defaults
const DEFAULT_SUMMARIZE_THRESHOLD = 30;
const DEFAULT_SUMMARIZE_MIN_CHARS = 15000;
const DEFAULT_KEEP_RECENT = 6;
const DEFAULT_MAX_ITERATIONS = 10;

const adapters: Record<string, ProviderAdapter> = {
    openai: new OpenAIAdapter(),
    anthropic: new AnthropicAdapter(),
};

export interface UseAssistantReturn {
    messages: DisplayMessage[];
    isProcessing: boolean;
    pendingConfirmations: PendingConfirmation[];
    model: string;
    autoConfirm: boolean;
    debugMode: boolean;
    pendingDebugPayload: DebugPayload | null;

    sendMessage: (text: string) => Promise<void>;
    stop: () => void;
    clearHistory: () => void;
    setModel: (model: string) => void;
    setAutoConfirm: (val: boolean) => void;
    setDebugMode: (val: boolean) => void;
    confirmToolCall: (callId: string) => Promise<void>;
    rejectToolCall: (callId: string) => void;
    approveDebugPayload: () => void;
    rejectDebugPayload: () => void;
}

export function useAssistant(
    config: AssistantConfig,
    registry: ToolRegistry,
    toolContext: unknown,
): UseAssistantReturn {
    // ─── Conversation state ──────────────────────────────────────────
    const [chatMessages, setChatMessages] = useState<unknown[]>([]);
    const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [pendingConfirmations, setPendingConfirmations] = useState<PendingConfirmation[]>([]);
    const [pendingDebugPayload, setPendingDebugPayload] = useState<DebugPayload | null>(null);

    // ─── Settings ────────────────────────────────────────────────────
    const [model, setModel] = useState(config.defaultModel || '');
    const [autoConfirm, setAutoConfirm] = useState(false);
    const [debugMode, setDebugMode] = useState(false);

    // ─── Refs (non-reactive) ─────────────────────────────────────────
    const abortRef = useRef<AbortController | null>(null);
    const chatMessagesRef = useRef(chatMessages);
    chatMessagesRef.current = chatMessages;
    const displayMessagesRef = useRef(displayMessages);
    displayMessagesRef.current = displayMessages;
    const autoConfirmRef = useRef(autoConfirm);
    autoConfirmRef.current = autoConfirm;
    const debugModeRef = useRef(debugMode);
    debugModeRef.current = debugMode;
    const modelRef = useRef(model);
    modelRef.current = model;

    // ─── Helpers ─────────────────────────────────────────────────────
    const appendDisplay = useCallback((msg: DisplayMessage) => {
        setDisplayMessages((prev) => [...prev, msg]);
    }, []);

    const appendChatMessage = useCallback((msg: unknown) => {
        setChatMessages((prev) => [...prev, msg]);
    }, []);

    // ─── Confirmation handling ───────────────────────────────────────
    const waitForConfirmation = useCallback(
        (toolCall: ToolCall): Promise<unknown> => {
            return new Promise((resolve) => {
                const confirmation: PendingConfirmation = {
                    callId: toolCall.id,
                    toolName: toolCall.name,
                    arguments: toolCall.arguments,
                    description: _describeToolCall(toolCall, registry),
                    resolve,
                };
                setPendingConfirmations((prev) => [...prev, confirmation]);
                appendDisplay({
                    role: 'confirmation',
                    toolName: toolCall.name,
                    arguments: toolCall.arguments,
                    callId: toolCall.id,
                    timestamp: Date.now(),
                });
            });
        },
        [registry, appendDisplay],
    );

    const confirmToolCall = useCallback(
        async (callId: string) => {
            setPendingConfirmations((prev) => {
                const pending = prev.find((p) => p.callId === callId);
                if (!pending) return prev;

                // Execute async — we need to handle this outside the state setter
                (async () => {
                    const params = config.transformParams
                        ? config.transformParams(pending.arguments)
                        : pending.arguments;
                    const rawResult = await registry.execute(pending.toolName, params, toolContext);
                    const result = config.transformResult
                        ? config.transformResult(rawResult)
                        : rawResult;

                    config.onToolExecute?.(pending.toolName, pending.arguments, result);

                    setDisplayMessages((dm) =>
                        dm.map((m) =>
                            m.role === 'confirmation' && 'callId' in m && m.callId === callId
                                ? ({
                                      role: 'tool_call',
                                      toolName: pending.toolName,
                                      arguments: pending.arguments,
                                      result,
                                      status:
                                          (result as Record<string, unknown>)?.success !== false
                                              ? 'success'
                                              : 'error',
                                      timestamp: m.timestamp,
                                  } as ToolCallMessage)
                                : m,
                        ),
                    );
                    pending.resolve(result);
                })();

                return prev.filter((p) => p.callId !== callId);
            });
        },
        [config, registry, toolContext],
    );

    const rejectToolCall = useCallback((callId: string) => {
        setPendingConfirmations((prev) => {
            const pending = prev.find((p) => p.callId === callId);
            if (!pending) return prev;

            const result = { success: false, error: 'User rejected this action.' };
            setDisplayMessages((dm) =>
                dm.map((m) =>
                    m.role === 'confirmation' && 'callId' in m && m.callId === callId
                        ? ({
                              role: 'tool_call',
                              toolName: pending.toolName,
                              arguments: pending.arguments,
                              result,
                              status: 'rejected' as const,
                              timestamp: m.timestamp,
                          } as ToolCallMessage)
                        : m,
                ),
            );
            pending.resolve(result);
            return prev.filter((p) => p.callId !== callId);
        });
    }, []);

    // ─── Debug payload handling ──────────────────────────────────────
    const approveDebugPayload = useCallback(() => {
        setPendingDebugPayload((p) => {
            p?.resolve(true);
            return null;
        });
    }, []);

    const rejectDebugPayload = useCallback(() => {
        setPendingDebugPayload((p) => {
            p?.resolve(false);
            return null;
        });
    }, []);

    // ─── Agentic loop ────────────────────────────────────────────────
    const runLoop = useCallback(async () => {
        const maxIter = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
        // Resolve adapter: custom ProviderAdapter instance or built-in name
        const adapter: ProviderAdapter =
            typeof config.provider === 'object' && config.provider !== null
                ? config.provider
                : adapters[config.provider || 'openai'] || adapters.openai;
        const summarizeThreshold = config.summarizeThreshold ?? DEFAULT_SUMMARIZE_THRESHOLD;
        const summarizeMinChars = config.summarizeMinChars ?? DEFAULT_SUMMARIZE_MIN_CHARS;

        for (let i = 0; i < maxIter; i++) {
            if (abortRef.current?.signal.aborted) return;

            // ── Auto-summarize if conversation too long ──
            if (config.summarize) {
                const currentMessages = chatMessagesRef.current;
                const totalChars = currentMessages.reduce<number>((sum, m) => {
                    const msg = m as Record<string, unknown>;
                    const c = msg.content;
                    return (
                        sum +
                        (typeof c === 'string' ? c.length : JSON.stringify(c || '').length)
                    );
                }, 0);

                if (currentMessages.length >= summarizeThreshold && totalChars >= summarizeMinChars) {
                    try {
                        let splitIndex = currentMessages.length - DEFAULT_KEEP_RECENT;
                        while (
                            splitIndex > 0 &&
                            (currentMessages[splitIndex] as Record<string, unknown>).role === 'tool'
                        ) {
                            splitIndex--;
                        }
                        if (splitIndex > 0) {
                            const older = currentMessages.slice(0, splitIndex);
                            const recent = currentMessages.slice(splitIndex);
                            const summary = await config.summarize(older);

                            if (summary?.trim()) {
                                const summaryMsg = {
                                    role: 'user',
                                    content: `[Previous conversation summary: ${summary}]`,
                                };
                                setChatMessages([summaryMsg, ...recent]);
                                chatMessagesRef.current = [summaryMsg, ...recent];
                                appendDisplay({
                                    role: 'memory',
                                    summary: `Summarized ${older.length} messages`,
                                    timestamp: Date.now(),
                                });
                            }
                        }
                    } catch (err) {
                        console.warn('Auto-summarize failed (non-blocking):', err);
                    }
                }
            }

            // ── Build request ──
            const context = config.buildContext?.() || undefined;
            const requestBody: CompletionRequest = {
                messages: chatMessagesRef.current,
                model: modelRef.current,
                temperature: config.temperature ?? 0.3,
                max_tokens: config.maxTokens ?? 4096,
                ...(context ? { context } : {}),
            };

            // ── Debug mode gate ──
            if (debugModeRef.current) {
                if (abortRef.current?.signal.aborted) return;
                const approved = await new Promise<boolean>((resolve) => {
                    setPendingDebugPayload({ requestBody, resolve });
                });
                if (!approved) {
                    appendDisplay({
                        role: 'assistant',
                        content: 'Request discarded by user (debug mode).',
                        timestamp: Date.now(),
                        isWarning: true,
                    });
                    return;
                }
                if (abortRef.current?.signal.aborted) return;
            }

            // ── Call LLM ──
            let data: unknown;
            try {
                data = await config.fetchCompletion(requestBody);
            } catch (err) {
                throw new Error(
                    `Assistant API error: ${err instanceof Error ? err.message : String(err)}`,
                );
            }

            const { content, toolCalls } = adapter.parseResponse(data);

            // ── No tool calls → final text response ──
            if (!toolCalls || toolCalls.length === 0) {
                const assistantMsg = { role: 'assistant', content: content || '' };
                appendChatMessage(assistantMsg);
                chatMessagesRef.current = [...chatMessagesRef.current, assistantMsg];
                appendDisplay({
                    role: 'assistant',
                    content: content || '',
                    timestamp: Date.now(),
                });
                return; // done
            }

            // ── Has tool calls → execute them ──
            const assistantToolMsg = adapter.formatAssistantToolCallMessage(content, toolCalls);
            appendChatMessage(assistantToolMsg);
            chatMessagesRef.current = [...chatMessagesRef.current, assistantToolMsg];

            if (content) {
                appendDisplay({
                    role: 'assistant',
                    content,
                    timestamp: Date.now(),
                });
            }

            const batchId = Date.now();
            const toolResults: Array<{ id: string; name: string; result: unknown }> = [];

            for (const tc of toolCalls) {
                if (abortRef.current?.signal.aborted) return;

                const needsConfirm = registry.requiresConfirmation(tc.name);

                if (needsConfirm && !autoConfirmRef.current) {
                    const result = await waitForConfirmation(tc);
                    toolResults.push({ id: tc.id, name: tc.name, result });
                } else {
                    // Show running card
                    const toolDisplay: ToolCallMessage = {
                        role: 'tool_call',
                        toolName: tc.name,
                        arguments: tc.arguments,
                        timestamp: Date.now(),
                        status: 'running',
                        _batchId: batchId,
                    };
                    appendDisplay(toolDisplay);

                    // Execute with optional transforms
                    const params = config.transformParams
                        ? config.transformParams(tc.arguments)
                        : tc.arguments;
                    const rawResult = await registry.execute(tc.name, params, toolContext);
                    const result = config.transformResult
                        ? config.transformResult(rawResult)
                        : rawResult;

                    config.onToolExecute?.(tc.name, tc.arguments, result);

                    // Update card status
                    setDisplayMessages((prev) =>
                        prev.map((m) =>
                            m === toolDisplay
                                ? {
                                      ...m,
                                      result,
                                      status:
                                          (result as Record<string, unknown>)?.success !== false
                                              ? ('success' as const)
                                              : ('error' as const),
                                  }
                                : m,
                        ),
                    );

                    toolResults.push({ id: tc.id, name: tc.name, result });
                }
            }

            // Add tool results to conversation history
            const resultMessages = adapter.formatToolResults(toolResults);
            setChatMessages((prev) => [...prev, ...resultMessages]);
            chatMessagesRef.current = [...chatMessagesRef.current, ...resultMessages];

            // Loop: send results back to LLM for follow-up
        }

        // Max iterations reached
        appendDisplay({
            role: 'assistant',
            content: 'Reached maximum tool call iterations. Some actions may be incomplete.',
            timestamp: Date.now(),
            isWarning: true,
        });
    }, [config, registry, toolContext, waitForConfirmation, appendDisplay, appendChatMessage]);

    // ─── Public actions ──────────────────────────────────────────────
    const sendMessage = useCallback(
        async (text: string) => {
            const trimmed = text.trim();
            if (!trimmed || isProcessing) return;

            abortRef.current = new AbortController();
            setIsProcessing(true);

            const userMsg = { role: 'user', content: trimmed };
            setChatMessages((prev) => [...prev, userMsg]);
            chatMessagesRef.current = [...chatMessagesRef.current, userMsg];
            appendDisplay({ role: 'user', content: trimmed, timestamp: Date.now() });

            try {
                await runLoop();
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
                const message = err instanceof Error ? err.message : 'Something went wrong.';
                console.error('Assistant error:', err);
                config.onError?.(err instanceof Error ? err : new Error(message));
                appendDisplay({
                    role: 'assistant',
                    content: `Error: ${message}`,
                    timestamp: Date.now(),
                    isError: true,
                });
            } finally {
                abortRef.current = null;
                setIsProcessing(false);
            }
        },
        [isProcessing, runLoop, appendDisplay, config],
    );

    const stop = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;

        setPendingDebugPayload((p) => {
            p?.resolve(false);
            return null;
        });

        setIsProcessing(false);
        setPendingConfirmations([]);
        appendDisplay({
            role: 'assistant',
            content: 'Stopped by user.',
            timestamp: Date.now(),
            isWarning: true,
        });
    }, [appendDisplay]);

    const clearHistory = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;

        setPendingDebugPayload((p) => {
            p?.resolve(false);
            return null;
        });

        setChatMessages([]);
        chatMessagesRef.current = [];
        setDisplayMessages([]);
        setPendingConfirmations([]);
        setIsProcessing(false);
    }, []);

    return {
        messages: displayMessages,
        isProcessing,
        pendingConfirmations,
        model,
        autoConfirm,
        debugMode,
        pendingDebugPayload,
        sendMessage,
        stop,
        clearHistory,
        setModel,
        setAutoConfirm,
        setDebugMode,
        confirmToolCall,
        rejectToolCall,
        approveDebugPayload,
        rejectDebugPayload,
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _describeToolCall(tc: ToolCall, registry: ToolRegistry): string {
    const tool = registry.getTool(tc.name);
    const desc = tool?.description || tc.name;
    const argsStr = Object.entries(tc.arguments || {})
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
    return `${desc}${argsStr ? ` (${argsStr})` : ''}`;
}