# LLM Telegram Bot - Onboarding Guide

## Project Overview

**Name:** llm-telegram-bot

**Languages:** TypeScript, Bash

**Frameworks:** Grammy (Telegram), Oak (HTTP Server), OpenAI SDK

**Description:** A Telegram bot that integrates multiple LLM providers (Pollinations, GitHub Copilot, Gemini, OpenAI, etc.) with conversation history and Deno KV storage.

---

## Architecture Layers

### 1. Entry Layer
Application bootstrap, startup scripts, and webhook configuration for the Oak HTTP server and Grammy Telegram bot.

**Key Files:**
- `main.ts` - Application entry point that bootstraps Oak HTTP server and Grammy Telegram bot
- `devrun.sh` - Development runner script with environment setup

### 2. Handler Layer
Grammy command and message handlers that process user input and route to appropriate LLM services.

**Key Files:**
- `src/handlers/index.ts` - Barrel file that re-exports all LLM provider handlers
- `src/handlers/HandlerUtils.ts` - Factory module providing `createVisionHandler`, `createTextOnlyHandler`, `createHybridHandler`

### 3. Service Layer
LLM provider integrations, Telegram service, tool execution, and utility services for text generation, vision, and audio.

**Key Files:**
- `src/service/openai/OpenAIService.ts` - Base service class for OpenAI API interactions
- `src/service/TelegramService.ts` - Core Telegram bot service handling webhook setup and model routing
- `src/service/ToolService.ts` - Tool service providing web search, URL fetching, YouTube transcription
- `src/service/openai/AntigravityService.ts` - Google's Antigravity API (Cloud Code) integration

### 4. Repository Layer
Deno KV storage for chat history and user model preferences with compression.

**Key Files:**
- `src/repository/ChatRepository.ts` - Deno KV-based repository with compression

### 5. Adapter Layer
Data transformation adapters for tool usage on text-only LLM providers.

**Key Files:**
- `src/adapter/ToolUsageAdapter.ts` - Enables function/tool calling on text-only chatbots

### 6. Utility Layer
Helper functions, prototype extensions, and configuration utilities.

**Key Files:**
- `src/config/models.ts` - Central configuration for all LLM provider model identifiers
- `src/prototype/ContextExtensionPrototype.ts` - Grammy Context interface extensions

---

## Key Concepts

### Handler Factory Pattern
The project uses a factory pattern for creating handlers. `HandlerUtils.ts` provides three factory functions:
- `createVisionHandler` - For models that support image input
- `createTextOnlyHandler` - For text-only models
- `createHybridHandler` - For models with mixed capabilities

### OpenAI-Compatible Architecture
All LLM providers extend `OpenAIService`, providing a consistent interface for:
- Streaming text generation
- Image generation (DALL-E, Flux, etc.)
- Audio transcription
- Tool/function calling

### Agent Loop Pattern
`AgentLoopExecutor` implements an iterative execution pattern where tool calls are processed until the model returns a final response, with token-aware summarization.

### Antigravity Integration
Specialized integration for Google's Antigravity/Cloud Code API with:
- OAuth2 authentication with automatic token refresh
- OpenAI-to-Gemini format transformation
- Thinking block management for Claude models

---

## Guided Tour

### Step 1: Start at the App Entry
Learn how the Oak HTTP server and Grammy Telegram bot are initialized.
- `main.ts`

### Step 2: Explore the Handler Layer
Discover how Grammy handlers process commands and route to LLM services.
- `src/handlers/index.ts`
- `src/handlers/HandlerUtils.ts`

### Step 3: Understand the Service Architecture
Explore how LLM providers are integrated with streaming and tool support.
- `src/service/openai/OpenAIService.ts`
- `src/service/TelegramService.ts`

### Step 4: Advanced Provider Integration
Learn about Antigravity service with OAuth, streaming, and thinking blocks.
- `src/service/openai/AntigravityService.ts`

### Step 5: Data Persistence Layer
Understand how Deno KV stores chat history with compression.
- `src/repository/ChatRepository.ts`

### Step 6: Tool Execution System
Explore how function calling and external tools are implemented.
- `src/service/ToolService.ts`
- `src/adapter/ToolUsageAdapter.ts`

---

## File Map by Layer

### Entry Layer
| File | Purpose | Complexity |
|------|---------|------------|
| `main.ts` | App bootstrap, Oak server, Grammy bot setup | Complex |
| `devrun.sh` | Development runner with env setup | Simple |
| `run_tests.sh` | Test runner with coverage | Simple |

### Handler Layer
| File | Purpose | Complexity |
|------|---------|------------|
| `HandlerUtils.ts` | Handler factory functions | Moderate |
| `OpenAIHandler.ts` | OpenAI/GPT handler | Moderate |
| `AntigravityHandler.ts` | Antigravity/Gemini handler | Simple |
| `GeminiHandler.ts` | Google Gemini handler | Simple |
| `GithubCopilotHandler.ts` | GitHub Copilot handler | Simple |
| `GroqHandler.ts` | Groq/Llama handler | Simple |
| `PerplexityHandler.ts` | Perplexity search handler | Simple |
| `CloudflareHandler.ts` | Cloudflare AI handler | Moderate |
| `ElevenlabsHandler.ts` | TTS handler | Moderate |

### Service Layer
| File | Purpose | Complexity |
|------|---------|------------|
| `OpenAIService.ts` | Base OpenAI service | Complex |
| `AntigravityService.ts` | Google Cloud Code service | Complex |
| `TelegramService.ts` | Core bot service | Complex |
| `ToolService.ts` | Tool execution service | Complex |
| `CloudFlareService.ts` | Cloudflare Workers AI | Complex |
| `AgentLoopExecutor.ts` | Agent loop orchestrator | Complex |
| `VertexAiService.ts` | Google Vertex AI | Complex |

### Repository Layer
| File | Purpose | Complexity |
|------|---------|------------|
| `ChatRepository.ts` | Deno KV storage | Moderate |

### Adapter Layer
| File | Purpose | Complexity |
|------|---------|------------|
| `ToolUsageAdapter.ts` | Tool calling adapter | Complex |

---

## Complexity Hotspots

Approach these files carefully - they contain the most complex logic:

### Complex Files

1. **`main.ts`** - Application bootstrap with multiple initialization paths
2. **`src/service/openai/OpenAIService.ts`** - Base class with streaming, tools, and agent loop
3. **`src/service/openai/AntigravityService.ts`** - OAuth + format transformation + thinking blocks
4. **`src/service/TelegramService.ts`** - Webhook setup, model routing, admin controls
5. **`src/service/ToolService.ts`** - Multiple external API integrations
6. **`src/service/openai/agent/AgentLoopExecutor.ts`** - Iterative tool execution with summarization
7. **`src/service/openai/VertexAiService.ts`** - OAuth2 with ADC and service account support
8. **`src/service/CloudFlareService.ts`** - Multi-modal AI integration
9. **`src/adapter/ToolUsageAdapter.ts`** - Tool calling for text-only models
10. **`src/service/antigravity/AntigravitySchemaCleanup.ts`** - JSON Schema transformation
11. **`src/prototype/ContextExtensionPrototype.ts`** - Grammy context extensions

---

## Quick Start

```bash
# Install Deno (if not installed)
curl -fsSL https://deno.land/install.sh | sh

# Clone and setup
git clone <repo-url>
cd llm-telegram-bot

# Copy environment template
cp .env.example .env
# Edit .env with your API keys

# Run in development
deno task dev

# Run tests
deno task test
```

---

*Generated from knowledge graph on 2026-03-24*
