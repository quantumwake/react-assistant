# @quantumwake/react-assistant

A reusable React assistant component with an agentic tool-calling loop. Supports OpenAI and Anthropic LLM backends.

## Features

- **Agentic loop** — multi-turn tool calling (up to N iterations per user message)
- **Tool registry** — register custom tools with JSON Schema parameters
- **Provider adapters** — OpenAI and Anthropic response format support
- **Confirmation gates** — pause for user approval on destructive actions
- **Debug mode** — inspect outgoing LLM requests before sending
- **Auto-summarization** — optional conversation compaction for long sessions
- **Themeable** — pass CSS class names for full visual control
- **Headless option** — use `useAssistantContext()` to build your own UI

## Install

```bash
npm install @quantumwake/react-assistant
```

## Quick Start

```tsx
import {
    AssistantProvider,
    AssistantChat,
    ToolRegistry,
} from '@quantumwake/react-assistant';
import type { AssistantConfig } from '@quantumwake/react-assistant';

// 1. Create a tool registry and register tools
const registry = new ToolRegistry();

registry.register({
    name: 'get_time',
    description: 'Get the current time',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({ success: true, time: new Date().toISOString() }),
});

registry.register({
    name: 'delete_item',
    description: 'Delete an item (destructive)',
    confirm: true,  // requires user confirmation
    parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
    },
    execute: async (params, ctx) => {
        // ctx is whatever you pass as toolContext to AssistantProvider
        return { success: true, deleted: params.id };
    },
});

// 2. Configure the assistant
const config: AssistantConfig = {
    defaultModel: 'gpt-4o-mini',

    fetchCompletion: async (request) => {
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...request, tools: registry.getToolSchemas() }),
        });
        return resp.json();
    },

    fetchModels: async () => {
        const resp = await fetch('/api/models');
        return resp.json();
    },
};

// 3. Render
function App() {
    return (
        <AssistantProvider config={config} registry={registry}>
            <AssistantChat title="My Assistant" />
        </AssistantProvider>
    );
}
```

## API

### `AssistantProvider`

Wraps your chat UI with assistant state and actions.

| Prop | Type | Description |
|------|------|-------------|
| `config` | `AssistantConfig` | Required. LLM connection, callbacks, settings. |
| `registry` | `ToolRegistry` | Required. Registered tools. |
| `toolContext` | `unknown` | Optional. Passed to tool `execute()` as 2nd arg. |
| `theme` | `AssistantTheme` | Optional. CSS class names for styling. |

### `AssistantChat`

Drop-in chat UI component. Must be inside `<AssistantProvider>`.

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Header title. Default: `'Assistant'` |
| `placeholder` | `string` | Input placeholder text. |
| `welcomeMessage` | `ReactNode` | Custom welcome content. |
| `className` | `string` | Additional CSS classes. |

### `useAssistantContext()`

Hook to access assistant state and actions for custom UIs.

```tsx
const {
    messages,           // DisplayMessage[]
    isProcessing,       // boolean
    sendMessage,        // (text: string) => Promise<void>
    stop,               // () => void
    clearHistory,       // () => void
    setModel,           // (model: string) => void
    confirmToolCall,    // (callId: string) => Promise<void>
    rejectToolCall,     // (callId: string) => void
    // ...more
} = useAssistantContext();
```

### `ToolRegistry`

```ts
const registry = new ToolRegistry();
registry.register(tool);          // add a tool
registry.unregister('name');      // remove a tool
registry.getToolSchemas();        // OpenAI-format tool definitions
registry.requiresConfirmation('name');  // check confirm flag
```

### `AssistantConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `fetchCompletion` | `(req) => Promise` | **required** | Send completion request to LLM backend. |
| `provider` | `'openai' \| 'anthropic' \| ProviderAdapter` | `'openai'` | Response format, or a custom adapter instance. |
| `defaultModel` | `string` | `''` | Default model ID. |
| `fetchModels` | `() => Promise<ModelInfo[]>` | — | Fetch available models. |
| `buildContext` | `() => Record` | — | Extra context merged into each request. |
| `transformParams` | `(params) => params` | — | Transform tool params before execution. |
| `transformResult` | `(result) => result` | — | Transform tool results after execution. |
| `summarize` | `(messages) => Promise<string>` | — | Auto-summarize long conversations. |
| `maxIterations` | `number` | `10` | Max LLM round-trips per user message. |
| `temperature` | `number` | `0.3` | LLM temperature. |
| `maxTokens` | `number` | `4096` | LLM max tokens. |
| `onError` | `(error) => void` | — | Error callback. |
| `onToolExecute` | `(name, params, result) => void` | — | Tool execution callback. |

## Example App

See [`examples/basic-app/`](examples/basic-app/) for a full working example with:

- **FastAPI backend** — proxies to OpenAI/Anthropic, format converters, auth placeholder
- **React frontend** — Zustand store as `toolContext`, 6 registered tools, notes CRUD
- **Docker Compose** — containerized API

```bash
# 1. Start the API
cd examples/basic-app/api
cp .env.example .env        # add your API keys
uv pip install -r requirements.txt
uvicorn main:app --port 8010 --reload

# 2. Start the frontend
cd examples/basic-app
npm install && npm run dev
```

Or with Docker:

```bash
cd examples/basic-app
OPENAI_API_KEY=sk-... docker compose up api
```

## Custom Provider Adapter

You can pass a custom `ProviderAdapter` instance for non-standard backends:

```ts
import { BaseProviderAdapter } from '@quantumwake/react-assistant';

class MyAdapter extends BaseProviderAdapter {
    parseResponse(response) { /* ... */ }
    formatToolResults(results) { /* ... */ }
    formatAssistantToolCallMessage(content, toolCalls) { /* ... */ }
}

const config: AssistantConfig = {
    provider: new MyAdapter(),
    // ...
};
```

## License

MIT