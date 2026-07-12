export const geminiModels = {
	geminiPro: 'gemini-3.1-pro-preview',
	geminiFlash: 'gemini-3.1-flash-lite-preview',
};

export const perplexityModels = {
	textModel: 'sonar',
	reasoningModel: 'sonar-reasoning-pro',
};

export const openAIModels = {
	gptModel: 'gpt-5-mini',
	imageModel: 'dall-e-3',
	sttModel: 'whisper-1',
};

export const openRouterModels = {
	freeModel: 'openrouter/free',
};

export const cloudflareModels = {
	imageModel: '@cf/black-forest-labs/flux-1-schnell',
	textModel: '@cf/moonshotai/kimi-k2.7-code',
	visionTextModel: '@cf/llava-hf/llava-1.5-7b-hf',
	sttModel: '@cf/openai/whisper-large-v3-turbo',
};

export const copilotModels = {
	gpt5mini: 'gpt-5-mini',
};

export const openWebUiModels = {};

export const pollinationsModels = {
	default: 'openai',
};

export const zaiModels = {
	flash: 'glm-5-turbo',
	standard: 'glm-5.2',
};

export const opencodeModels = {
	freeModel: 'deepseek-v4-flash-free',
};

export const screenpipeModels = {
	auto: 'auto',
	claudeHaiku: 'claude-haiku-4-5',
	geminiFlash: 'gemini-2.5-flash',
	gemini3Flash: 'gemini-3-flash',
	gemini31FlashLite: 'gemini-3.1-flash-lite',
	gemini35Flash: 'gemini-3.5-flash',
	glm47: 'glm-4.7',
	glm5: 'glm-5',
	kimiK25: 'kimi-k2.5',
	qwenFlash: 'qwen/qwen3.5-flash',
	llamaScout: 'meta-llama/llama-4-scout',
};

/**
 * Type definitions
 */
export const MODEL_COMMANDS = [
	'/polli',
	'/gpt',
	'/kimi',
	'/zai',
	'/glm',
	'/glmflash',
	'/free',
	'/opencode',
	'/screenpipe',
	'/gemini',
	'/geminiPro',
] as const;

/**
 * Available model commands
 */
export type ModelCommand = typeof MODEL_COMMANDS[number];
export const modelCommands = [...MODEL_COMMANDS] as ModelCommand[];

export const WHITELISTED_MODELS: ModelCommand[] = [
	'/polli',
	'/free',
	'/opencode',
	'/screenpipe',
];

export const MODELS_USING_RESPONSES_API: string[] = [
	'gpt-5-codex',
	'gpt-5.1-codex',
	'gpt-5.1-codex-mini',
	'gpt-5.1-codex-max',
	'gpt-5.2-codex',
	'gpt-5.4',
	'gpt-5.4-mini',
	'gpt-5.5',
];
