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

export const zaiModels = {
	flash: 'glm-5-turbo',
	standard: 'glm-5.2',
};

/**
 * Type definitions
 */
export const MODEL_COMMANDS = [
	'/gpt',
	'/kimi',
	'/zai',
	'/glm',
	'/glmflash',
	'/free',
	'/gemini',
	'/geminiPro'
] as const;

/**
 * Available model commands
 */
export type ModelCommand = typeof MODEL_COMMANDS[number];
export const modelCommands = [...MODEL_COMMANDS] as ModelCommand[];

export const WHITELISTED_MODELS: ModelCommand[] = [
  '/free'
];

export const MODELS_USING_RESPONSES_API: string[] = [
	'gpt-5-codex',
	'gpt-5.1-codex',
	'gpt-5.1-codex-mini',
	'gpt-5.1-codex-max',
	'gpt-5.2-codex',
	'gpt-5.4',
	'gpt-5.4-mini',
	'gpt-5.5'
];
