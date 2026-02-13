export const geminiModels = {
	geminiPro: 'gemini-2.5-pro',
	geminiFlash: 'gemini-2.5-flash-lite',
};

export const antigravityModels = {
	geminiFlash: 'gemini-3-flash',
	geminiPro: 'gemini-3-pro-preview',
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
	llamaModel: 'meta-llama/llama-4-maverick:free',
	deepseekModel: 'deepseek/deepseek-r1-zero:free',
};

export const cloudflareModels = {
	imageModel: '@cf/black-forest-labs/flux-1-schnell',
	textModel: '@cf/openai/gpt-oss-120b',
	visionTextModel: '@cf/llava-hf/llava-1.5-7b-hf',
	sttModel: '@cf/openai/whisper-large-v3-turbo',
};

export const copilotModels = {
	gemini: 'gemini-3-pro-preview',
	gpt5mini: 'gpt-5-mini',
	gpt5: 'gpt-5.2',
	claude: 'claude-sonnet-4.5',
	sonnetThinking: 'claude-opus-4.5',
};

export const pollinationsModels = {
	openai: 'openai',
};

export const openWebUiModels = {
	gpt5: 'pplx.gpt-5-search',
	grok: 'pplx.grok-4-search',
	o3: 'pplx.o3-search',
	sonnetThinking: 'pplx.claude-4.0-sonnet-think-search',
};

export const zaiModels = {
	flash: 'glm-4.7-flash',
};

/**
 * Type definitions
 */
export const MODEL_COMMANDS = [
	'/polli',
	'/gpt',
	'/llama',
	'/oss',
	'/gemini',
	'/geminiPro',
	'/antigravity',
	'/antigeminipro',
	'/zai',
] as const;

/**
 * Available model commands
 */
export type ModelCommand = typeof MODEL_COMMANDS[number];
export const modelCommands = [...MODEL_COMMANDS] as ModelCommand[];

export const WHITELISTED_MODELS: ModelCommand[] = [
	'/polli',
	'/llama',
	'/oss',
	'/gpt',
	'/zai',
];

export const MODELS_USING_RESPONSES_API: string[] = [
	'gpt-5-codex',
	'gpt-5.1-codex',
	'gpt-5.1-codex-mini',
	'gpt-5.1-codex-max',
	'gpt-5.2-codex',
];
