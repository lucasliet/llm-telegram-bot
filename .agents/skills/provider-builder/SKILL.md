---
name: provider-builder
description: Guide for adding new LLM providers to the LLM Telegram Bot ecosystem. Use when asked to integrate a new provider like Groq, Anthropic, or any OpenAI-compatible service.
---
# Provider Builder Skill

Expert guide for adding new LLM providers to the telegram bot ecosystem.

## Workflow

### 1. Config (`src/config/models.ts`)
Add the model IDs to a new constant. Example:
```typescript
export const myNewProviderModels = {
	modelA: 'provider-id-a',
	modelB: 'provider-id-b',
};
```
Also update `MODEL_COMMANDS` and `WHITELISTED_MODELS` if these are user-facing commands.

### 2. Service Layer (`src/service/openai/`)
Extend `OpenAiService` for OpenAI-compatible APIs. 
```typescript
import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';

const API_KEY = Deno.env.get('MY_PROVIDER_API_KEY') as string;

export default class MyProviderService extends OpenAiService {
	public constructor(model: string, maxTokens: number = 131072) {
		super(
			new OpenAi({
				apiKey: API_KEY,
				baseURL: 'https://api.my-provider.com/v1',
			}),
			model,
			true,
			maxTokens,
		);
	}
}
```

### 3. Handler Layer (`src/handlers/`)
Create a new `*Handler.ts` using `createTextOnlyHandler` or `createVisionHandler`.
```typescript
import MyProviderService from '@/service/openai/MyProviderService.ts';
import { createTextOnlyHandler } from './HandlerUtils.ts';
import { myNewProviderModels } from '@/config/models.ts';

const modelMap = {
	'cmdA': myNewProviderModels.modelA,
	'cmdB': myNewProviderModels.modelB,
};

export const handleMyProvider = createTextOnlyHandler({
	modelMap,
	createService: (model) => new MyProviderService(model!),
});
```
Export it in `src/handlers/index.ts`.

### 4. Integration (`src/service/TelegramService.ts`)
- Add mapping to `modelHandlers` in `replyTextContent`.
- Create `callMyProviderModel(ctx: Context, commandMessage?: string): Promise<void>` helper.

### 5. Main Loop (`main.ts`)
Add `BOT.hears` for command prefixes:
```typescript
	BOT.hears(
		/^(prefixA|prefixB):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callMyProviderModel),
	);
```

## Standards
- **No Comments**: Write self-documenting code.
- **TSDocs**: Required for all classes and functions.
- **Deno Lint**: Always run `deno lint` before finalizing.
- **Surgical Edits**: Use `replace` to modify existing files.
