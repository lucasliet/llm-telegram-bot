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

export const cloudflareModels = {
	imageModel: '@cf/black-forest-labs/flux-1-schnell',
	textModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
	visionTextModel: '@cf/llava-hf/llava-1.5-7b-hf',
	sqlModel: '@cf/defog/sqlcoder-7b-2',
	codeModel: '@hf/thebloke/deepseek-coder-6.7b-instruct-awq',
	sttModel: '@cf/openai/whisper',
};

export const blackboxModels = {
	reasoningModel: 'deepseek-reasoner|DeepSeek-R1',
	reasoningModelOffline: 'deepseek-reasoner|DeepSeek-R1',
	gptModel: 'GPT-4o|GPT-4o',
	llamaModel:
	'meta-llama/Llama-3.3-70B-Instruct-Turbo|Meta-Llama-3.3-70B-Instruct-Turbo',
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
	| '/geminiPro';

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
];

export const WHITELISTED_MODELS: ModelCommand[] = [
	'/llama',
	'/r1off',
	'/r1',
	'/qwen',
	'/mixtral',
	'/gpt',
];

/**
 * Named model commands for improved readability
 */
export const [
	geminiModelCommand,
	llamaModelCommand,
	gptModelCommand,
	perplexityModelCommand,
	perplexityReasoningModelCommand,
	blackboxReasoningModelCommand,
	blackboxReasoningOffModelCommand,
	blackboxQwenModelCommand,
	blackboxMixtralModelCommand,
	blackboxClaudeModelCommand,
	blackboxGeminiProModelCommand,
] = modelCommands;
