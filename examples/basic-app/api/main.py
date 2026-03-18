"""
Minimal assistant backend API.

Proxies chat completion requests to OpenAI or Anthropic based on model name.
No auth required — just set OPENAI_API_KEY and/or ANTHROPIC_API_KEY env vars.

Usage:
    pip install -r requirements.txt
    uvicorn main:app --port 8010

Endpoints:
    GET  /api/assistant/models       — list available models
    POST /api/assistant/chat         — chat completion with tool support
"""
import os
import json
import logging
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load .env file (if present) before reading env vars
load_dotenv()

logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "300"))

# ─── Clients ──────────────────────────────────────────────────────────────────

openai_client = None
anthropic_client = None

if OPENAI_API_KEY:
    try:
        from openai import OpenAI
        openai_client = OpenAI(api_key=OPENAI_API_KEY, timeout=LLM_TIMEOUT)
        logger.info("OpenAI client initialized")
    except ImportError:
        logger.warning("openai package not installed — OpenAI models unavailable")

if ANTHROPIC_API_KEY:
    try:
        import anthropic
        anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY, timeout=LLM_TIMEOUT)
        logger.info("Anthropic client initialized")
    except ImportError:
        logger.warning("anthropic package not installed — Anthropic models unavailable")

# ─── Available Models ─────────────────────────────────────────────────────────

OPENAI_MODELS = [
    {"id": "gpt-4o", "name": "GPT-4o", "provider": "openai"},
    {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "provider": "openai"},
]

ANTHROPIC_MODELS = [
    {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "provider": "anthropic"},
    {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5", "provider": "anthropic"},
]

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check — shows which providers are configured."""
    return {
        "status": "ok",
        "providers": {
            "openai": openai_client is not None,
            "anthropic": anthropic_client is not None,
        },
        "endpoints": [
            "GET  /api/assistant/models",
            "POST /api/assistant/chat",
        ],
    }


# ─── Auth placeholder ────────────────────────────────────────────────────────
# In production, validate JWT/cookie here and extract claims.
# For this example, we always return a valid placeholder user.

def get_current_user(request: Request) -> dict:
    """
    Placeholder auth — always returns a valid user.
    Replace with real JWT validation for production use.
    """
    # Example: extract from Authorization header
    # auth_header = request.headers.get("Authorization", "")
    # token = auth_header.replace("Bearer ", "")
    # claims = validate_jwt(token)
    return {
        "user_id": "example-user-001",
        "email": "user@example.com",
    }


# ─── Request Models ──────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    messages: list
    model: str = "gpt-4o-mini"
    temperature: float = 0.3
    max_tokens: int = 4096
    tools: Optional[list] = None
    context: Optional[dict] = None  # ignored by this simple backend


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/assistant/models")
async def list_models(request: Request):
    """Return available models based on configured API keys."""
    _ = get_current_user(request)  # auth check placeholder
    models = []
    if openai_client:
        models.extend(OPENAI_MODELS)
    if anthropic_client:
        models.extend(ANTHROPIC_MODELS)
    return models


@app.post("/api/assistant/chat")
async def chat_completion(body: ChatRequest, request: Request):
    """
    Chat completion proxy with tool support.
    Routes to OpenAI or Anthropic based on model name.
    Returns OpenAI-compatible response format.
    """
    user = get_current_user(request)
    logger.info(f"Chat request from user={user['user_id']} model={body.model}")

    is_anthropic = body.model.startswith("claude")

    if is_anthropic:
        return await _call_anthropic(body)
    else:
        return await _call_openai(body)


# ─── OpenAI ──────────────────────────────────────────────────────────────────

async def _call_openai(body: ChatRequest) -> dict:
    if not openai_client:
        return _error_response("OpenAI client not configured — set OPENAI_API_KEY")

    kwargs = {
        "model": body.model,
        "messages": body.messages,
        "temperature": body.temperature,
        "max_tokens": body.max_tokens,
    }
    if body.tools:
        kwargs["tools"] = body.tools

    try:
        response = openai_client.chat.completions.create(**kwargs)
        return response.model_dump()
    except Exception as e:
        logger.error(f"OpenAI error: {e}")
        return _error_response(str(e))


# ─── Anthropic ───────────────────────────────────────────────────────────────

async def _call_anthropic(body: ChatRequest) -> dict:
    """Call Anthropic and convert response to OpenAI format."""
    if not anthropic_client:
        return _error_response("Anthropic client not configured — set ANTHROPIC_API_KEY")

    # Extract system message
    system_content = ""
    conversation = []
    for msg in body.messages:
        if msg.get("role") == "system":
            system_content = msg.get("content", "")
        else:
            conversation.append(_convert_msg_to_anthropic(msg))

    # Merge consecutive same-role messages (Anthropic requirement)
    merged = []
    for msg in conversation:
        if merged and merged[-1]["role"] == msg["role"]:
            prev_content = merged[-1]["content"]
            curr_content = msg["content"]
            if isinstance(prev_content, str):
                prev_content = [{"type": "text", "text": prev_content}]
            if isinstance(curr_content, str):
                curr_content = [{"type": "text", "text": curr_content}]
            merged[-1]["content"] = prev_content + curr_content
        else:
            merged.append(msg)

    kwargs = {
        "model": body.model,
        "messages": merged,
        "temperature": body.temperature,
        "max_tokens": body.max_tokens,
    }
    if system_content:
        kwargs["system"] = system_content
    if body.tools:
        kwargs["tools"] = _convert_tools_to_anthropic(body.tools)

    try:
        response = anthropic_client.messages.create(**kwargs)
        return _convert_anthropic_response_to_openai(response)
    except Exception as e:
        logger.error(f"Anthropic error: {e}")
        return _error_response(str(e))


# ─── Format Converters ───────────────────────────────────────────────────────

def _convert_msg_to_anthropic(msg: dict) -> dict:
    """Convert a single OpenAI message to Anthropic format."""
    role = msg.get("role", "user")

    # Tool result messages → user message with tool_result content
    if role == "tool":
        return {
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": msg.get("tool_call_id", ""),
                "content": msg.get("content", ""),
            }],
        }

    # Assistant messages with tool_calls → assistant with tool_use content
    if role == "assistant" and msg.get("tool_calls"):
        parts = []
        if msg.get("content"):
            parts.append({"type": "text", "text": msg["content"]})
        for tc in msg["tool_calls"]:
            fn = tc.get("function", {})
            args = fn.get("arguments", "{}")
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    args = {}
            parts.append({
                "type": "tool_use",
                "id": tc.get("id", ""),
                "name": fn.get("name", ""),
                "input": args,
            })
        return {"role": "assistant", "content": parts}

    # Regular text messages
    return {"role": role, "content": msg.get("content", "")}


def _convert_tools_to_anthropic(tools: list) -> list:
    """Convert OpenAI tool schemas to Anthropic format."""
    result = []
    for tool in tools:
        fn = tool.get("function", {})
        result.append({
            "name": fn.get("name", ""),
            "description": fn.get("description", ""),
            "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
        })
    return result


def _convert_anthropic_response_to_openai(response) -> dict:
    """Convert Anthropic response to OpenAI chat completion format."""
    content_blocks = response.content or []

    text_parts = []
    tool_calls = []

    for block in content_blocks:
        if block.type == "text":
            text_parts.append(block.text)
        elif block.type == "tool_use":
            tool_calls.append({
                "id": block.id,
                "type": "function",
                "function": {
                    "name": block.name,
                    "arguments": json.dumps(block.input) if isinstance(block.input, dict) else str(block.input),
                },
            })

    message = {
        "role": "assistant",
        "content": "\n".join(text_parts) if text_parts else None,
    }
    if tool_calls:
        message["tool_calls"] = tool_calls

    return {
        "id": response.id,
        "object": "chat.completion",
        "model": response.model,
        "choices": [{"index": 0, "message": message, "finish_reason": response.stop_reason}],
        "usage": {
            "prompt_tokens": response.usage.input_tokens if response.usage else 0,
            "completion_tokens": response.usage.output_tokens if response.usage else 0,
        },
    }


def _error_response(message: str) -> dict:
    return {
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": f"Error: {message}"},
            "finish_reason": "error",
        }],
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("SERVICE_PORT_NO", "8010"))
    uvicorn.run(app, host="0.0.0.0", port=port)
