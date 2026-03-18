/**
 * @quantumwake/react-assistant — public type definitions.
 */

// ─── Tool System ─────────────────────────────────────────────────────────────

/** A tool definition registered with the ToolRegistry. */
export interface ToolDefinition {
    name: string;
    description: string;
    /** JSON Schema describing the parameters the LLM should provide. */
    parameters: Record<string, unknown>;
    /** Execute the tool. `context` is the opaque value from AssistantProvider's `toolContext` prop. */
    execute: (params: Record<string, unknown>, context: unknown) => Promise<unknown>;
    /** If true, the assistant pauses for user confirmation before executing. */
    confirm?: boolean;
    /** Optional grouping category (e.g. 'workflow', 'data'). */
    category?: string;
}

/** A parsed tool call from the LLM response. */
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

/** Result of executing a tool call. */
export interface ToolResult {
    id: string;
    name: string;
    result: unknown;
}

// ─── Provider Adapters ───────────────────────────────────────────────────────

/** Parsed response from an LLM provider. */
export interface ParsedResponse {
    content: string | null;
    toolCalls: ToolCall[];
}

/** Adapter interface for LLM provider response/request formats. */
export interface ProviderAdapter {
    /** Parse a raw provider response into content + tool calls. */
    parseResponse(response: unknown): ParsedResponse;
    /** Format tool execution results as messages to send back to the LLM. */
    formatToolResults(results: ToolResult[]): unknown[];
    /** Format the assistant's tool-call message for conversation history. */
    formatAssistantToolCallMessage(content: string | null, toolCalls: ToolCall[]): unknown;
}

// ─── Configuration ───────────────────────────────────────────────────────────

/** Request payload sent to the LLM. */
export interface CompletionRequest {
    messages: unknown[];
    model: string;
    temperature?: number;
    max_tokens?: number;
    context?: Record<string, unknown>;
    [key: string]: unknown;
}

/** Model info returned by fetchModels. */
export interface ModelInfo {
    id: string;
    name?: string;
    provider?: string;
}

/** Configuration the host app provides to AssistantProvider. */
export interface AssistantConfig {
    /** Send a completion request to the LLM backend. Host owns URL, auth, headers. */
    fetchCompletion: (request: CompletionRequest) => Promise<unknown>;

    /** Response format: 'openai' (default), 'anthropic', or a custom ProviderAdapter instance. */
    provider?: 'openai' | 'anthropic' | ProviderAdapter;

    /** Default model ID. */
    defaultModel?: string;

    /** Fetch available models for the model selector. */
    fetchModels?: () => Promise<ModelInfo[]>;

    /** Called on every loop iteration — return value merged into request as `context`. */
    buildContext?: () => Record<string, unknown>;

    /** Transform tool params before execution (e.g. short ID → UUID). */
    transformParams?: (params: Record<string, unknown>) => Record<string, unknown>;

    /** Transform tool results after execution (e.g. UUID → short ID). */
    transformResult?: (result: unknown) => unknown;

    /** Summarize older messages when conversation grows too long. */
    summarize?: (messages: unknown[]) => Promise<string>;

    /** Message count threshold before considering summarization. Default: 30. */
    summarizeThreshold?: number;

    /** Min total character size to trigger summarization. Default: 15000. */
    summarizeMinChars?: number;

    /** Called on errors. */
    onError?: (error: Error) => void;

    /** Called after each tool execution. */
    onToolExecute?: (name: string, params: unknown, result: unknown) => void;

    /** Max LLM round-trips per user message. Default: 10. */
    maxIterations?: number;

    /** LLM temperature. Default: 0.3. */
    temperature?: number;

    /** LLM max tokens. Default: 4096. */
    maxTokens?: number;
}

// ─── Theme ───────────────────────────────────────────────────────────────────

/** CSS class names for theming the built-in UI components. */
export interface AssistantTheme {
    bg?: string;
    text?: string;
    textMuted?: string;
    textAccent?: string;
    border?: string;
    hover?: string;
}

// ─── Display Messages ────────────────────────────────────────────────────────

export interface UserMessage {
    role: 'user';
    content: string;
    timestamp: number;
}

export interface AssistantMessage {
    role: 'assistant';
    content: string;
    timestamp: number;
    isError?: boolean;
    isWarning?: boolean;
}

export interface ToolCallMessage {
    role: 'tool_call';
    toolName: string;
    arguments: unknown;
    result?: unknown;
    status: 'running' | 'success' | 'error' | 'rejected';
    timestamp: number;
    /** @internal batch tracking */
    _batchId?: number;
}

export interface ConfirmationMessage {
    role: 'confirmation';
    toolName: string;
    arguments: unknown;
    callId: string;
    timestamp: number;
}

export interface MemoryMessage {
    role: 'memory';
    summary: string;
    timestamp: number;
}

export type DisplayMessage =
    | UserMessage
    | AssistantMessage
    | ToolCallMessage
    | ConfirmationMessage
    | MemoryMessage;

// ─── Internal ────────────────────────────────────────────────────────────────

/** @internal Pending confirmation awaiting user response. */
export interface PendingConfirmation {
    callId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    description: string;
    resolve: (result: unknown) => void;
}

/** @internal Debug payload shown for approval before sending. */
export interface DebugPayload {
    requestBody: CompletionRequest;
    resolve: (approved: boolean) => void;
}