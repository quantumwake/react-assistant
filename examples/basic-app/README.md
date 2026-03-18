# Basic App Example

A working example demonstrating `@quantumwake/react-assistant` with a FastAPI backend and Zustand state management.

## What's Included

### Backend (`api/`)

Minimal FastAPI server that proxies chat completion requests to OpenAI or Anthropic.

- **`GET /api/assistant/models`** — lists available models based on configured API keys
- **`POST /api/assistant/chat`** — chat completion with tool-calling support
- Format conversion between OpenAI and Anthropic APIs (always returns OpenAI format)
- Auth placeholder (`get_current_user`) — always returns valid, swap in real JWT validation for production
- Loads API keys from `.env` via `python-dotenv`

### Frontend (`src/`)

React app showing how to wire `@quantumwake/react-assistant` into a real application.

- **Zustand store** (`store.ts`) — notes CRUD as the app's state, passed as `toolContext` so tools can read/write it
- **6 registered tools** — `get_current_time`, `calculate`, `search_notes`, `create_note`, `list_notes`, `delete_note` (with confirmation)
- **Live sidebar** — shows notes updating in real-time as the assistant creates/deletes them
- **`AssistantChat`** — drop-in component with custom welcome message

## Setup

### 1. Backend

```bash
cd api
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY and/or ANTHROPIC_API_KEY

uv pip install -r requirements.txt
uvicorn main:app --port 8010 --reload
```

Or with Docker:

```bash
OPENAI_API_KEY=sk-... docker compose up api
```

### 2. Frontend

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Things to Try

- "List all my notes"
- "Search for meetings"
- "Create a note about weekend plans"
- "Delete the Shopping List note" (triggers confirmation)
- "What time is it?"
- "Calculate 123 * 456"

## Project Structure

```
basic-app/
├── api/
│   ├── main.py              # FastAPI backend
│   ├── requirements.txt     # Python deps (installed via uv)
│   ├── Dockerfile
│   └── .env.example         # API key template
├── src/
│   ├── App.tsx              # Main app — config, registry, layout
│   ├── store.ts             # Zustand notes store (toolContext)
│   └── main.tsx             # React entry point
├── docker-compose.yml
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```
