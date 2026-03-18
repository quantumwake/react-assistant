/**
 * @quantumwake/react-assistant
 *
 * A reusable React assistant component with tool-calling agentic loop.
 * Supports OpenAI and Anthropic LLM backends.
 */

// Core
export { ToolRegistry } from './ToolRegistry.js';
export { useAssistant } from './useAssistant.js';
export type { UseAssistantReturn } from './useAssistant.js';

// Context
export { AssistantProvider, useAssistantContext } from './AssistantProvider.js';
export type { AssistantProviderProps } from './AssistantProvider.js';

// Provider Adapters
export { BaseProviderAdapter } from './providers/BaseProviderAdapter.js';
export { OpenAIAdapter } from './providers/OpenAIAdapter.js';
export { AnthropicAdapter } from './providers/AnthropicAdapter.js';

// Components
export { AssistantChat } from './components/AssistantChat.js';
export type { AssistantChatProps } from './components/AssistantChat.js';
export { MessageBubble } from './components/MessageBubble.js';
export type { MessageBubbleProps } from './components/MessageBubble.js';
export { ToolCallCard } from './components/ToolCallCard.js';
export type { ToolCallCardProps } from './components/ToolCallCard.js';
export { ConfirmationCard } from './components/ConfirmationCard.js';
export type { ConfirmationCardProps } from './components/ConfirmationCard.js';
export { InputBar } from './components/InputBar.js';
export type { InputBarProps } from './components/InputBar.js';

// Types
export type {
    ToolDefinition,
    ToolCall,
    ToolResult,
    ParsedResponse,
    ProviderAdapter,
    CompletionRequest,
    ModelInfo,
    AssistantConfig,
    AssistantTheme,
    DisplayMessage,
    UserMessage,
    AssistantMessage,
    ToolCallMessage,
    ConfirmationMessage,
    MemoryMessage,
    PendingConfirmation,
    DebugPayload,
} from './types.js';
