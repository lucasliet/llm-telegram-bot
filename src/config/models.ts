export const geminiModel = 'gemini-2.0-flash-lite-preview-02-05';

export const perplexityModels = {
	textModel: 'sonar',
	reasoningModel: 'sonar-reasoning',
};

export const openAIModels = {
	gptModel: 'gpt-4o-mini',
	imageModel: 'dall-e-3',
	sttModel: 'whisper-1',
};

export const openRouterModels = {
	llamaModel: 'meta-llama/llama-4-maverick:free',
	deepseekModel: 'deepseek/deepseek-r1-zero:free',
	geminiModel: 'google/gemini-2.5-pro-exp-03-25:free',
};

export const cloudflareModels = {
	imageModel: '@cf/black-forest-labs/flux-1-schnell',
	textModel: '@cf/meta/llama-4-scout-17b-16e-instruct',
	visionTextModel: '@cf/llava-hf/llava-1.5-7b-hf',
	sqlModel: '@cf/defog/sqlcoder-7b-2',
	codeModel: '@hf/thebloke/deepseek-coder-6.7b-instruct-awq',
	sttModel: '@cf/openai/whisper',
};

export const blackboxModels = {
	reasoningModel: 'deepseek-reasoner|DeepSeek-R1',
	reasoningModelOffline: 'deepseek-reasoner|DeepSeek-R1',
	gptOnline: 'gpt-3.5-turbo',
	gptModel: 'GPT-4o|GPT-4o',
	llamaModel:
	'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8|Llama-4-Maverick-17B-128E',
	mixtralModel:
	'mistralai/Mistral-Small-24B-Instruct-2501|Mistral-Small-24B-Instruct-2501',
	qwenModel: 'Qwen/QwQ-32B-Preview|Qwen-QwQ-32B-Preview',
	deepseekv3: 'deepseek-chat|DeepSeek-V3',
	geminiModel: 'Gemini/Gemini-Flash-2.0|Gemini-Flash-2.0',
	geminiProModel: 'Gemini-PRO|Gemini-PRO',
	claudeModel: 'Claude-sonnet-3.7|Claude-sonnet-3.7',
	o1Model: 'o1|o1',
	o3MiniModel: 'o3-mini|o3-mini'
};

export const duckduckgoModels = {
	o3mini: 'o3-mini',
	gpt4omini: 'gpt-4o-mini',
	haiku: 'claude-3-haiku-20240307',
	llama: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
	mixtral: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
};

/**
 * Type definitions
 */
export type ModelCommand =
	| '/gemini'
	| '/llama'
	| '/gpt'
	| '/perplexity'
	| '/perplexityReasoning'
	| '/r1'
	| '/r1off'
	| '/qwen'
	| '/mixtral'
	| '/claude'
	| '/geminiPro'
	| '/o3mini'
	| '/o4mini'
	| '/phind';

/**
 * Available model commands
 */
export const modelCommands: ModelCommand[] = [
	'/gemini',
	'/llama',
	'/gpt',
	'/perplexity',
	'/perplexityReasoning',
	'/r1',
	'/r1off',
	'/qwen',
	'/mixtral',
	'/claude',
	'/geminiPro',
	'/o3mini',
	'/o4mini',
	'/phind',
];

export const WHITELISTED_MODELS: ModelCommand[] = [
	'/llama',
	'/r1off',
	'/r1',
	'/qwen',
	'/mixtral',
	'/gpt',
	'/gemini',
	'/claude',
	'/o3mini',
	'/phind',
];