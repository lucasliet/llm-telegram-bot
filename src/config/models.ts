export const geminiModels = {
	geminiFlash: 'gemini-3.7-flash',
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
	gpt5: 'gpt-5.2',
	claude: 'claude-sonnet-4.5',
};

export const zaiModels = {
	flash: 'glm-5.3-flash',
	standard: 'glm-5.3',
};

export const opencodeModels = {
	freeModel: 'mimo-v2.5-free',
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
	'/opencode',
	'/gemini',
] as const;

/**
 * Available model commands
 */
export type ModelCommand = typeof MODEL_COMMANDS[number];
export const modelCommands = [...MODEL_COMMANDS] as ModelCommand[];

export const WHITELISTED_MODELS: ModelCommand[] = [
	'/free',
	'/opencode',
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
