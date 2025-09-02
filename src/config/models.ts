export const geminiModels = {
	geminiPro: 'gemini-2.5-pro',
	geminiFlash: 'gemini-2.5-flash',
};

export const perplexityModels = {
	textModel: 'sonar',
	reasoningModel: 'sonar-reasoning',
};

export const openAIModels = {
	gptModel: 'gpt-5-mini',
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
	textModel: '@cf/openai/gpt-oss-120b',
	visionTextModel: '@cf/llava-hf/llava-1.5-7b-hf',
	sttModel: '@cf/openai/whisper-large-v3-turbo',
};

export const codexModels = {
	textModel: 'gpt-5',
};

export const blackboxModels = {
	reasoningModel: 'deepseek-reasoner|DeepSeek-R1',
	reasoningModelOnline: 'deepseek-reasoner|DeepSeek-R1',
	gptOnline: 'gpt-3.5-turbo',
	gptModel: 'GPT-4o|GPT-4o',
	llamaModel: 'meta-llama/llama-4-maverick|Llama 4 Maverick',
	mixtralModel: 'mistralai/Mistral-Small-24B-Instruct-2501|Mistral-Small-24B-Instruct-2501',
	qwenModel: 'Qwen/QwQ-32B-Preview|Qwen-QwQ-32B-Preview',
	deepseekv3: 'deepseek-chat|DeepSeek-V3',
	geminiModel: 'Gemini/Gemini-Flash-2.0|Gemini-Flash-2.0',
	geminiProModel: 'Gemini-PRO|Gemini-PRO',
	claudeModel: 'Claude-sonnet-3.7|Claude-sonnet-3.7',
	o1Model: 'o1|o1',
	o3MiniModel: 'o3-mini|o3-mini',
	o3miniHigh: 'openai/o3-mini-high|o3 Mini High',
	gpt41: 'openai/gpt-4.1|GPT-4.1',
	gpt45Preview: 'openai/gpt-4.5-preview|GPT-4.5 (Preview)',
	grok3Beta: 'x-ai/grok-3-beta|Grok 3',
};

export const duckduckgoModels = {
	o3mini: 'o3-mini',
	gpt4omini: 'gpt-4o-mini',
	haiku: 'claude-3-haiku-20240307',
	llama: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
	mixtral: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
};

export const copilotModels = {
	gemini: 'gemini-2.5-pro',
	o4mini: 'o4-mini',
	gpt5mini: 'gpt-5-mini',
	gpt5: 'gpt-5',
	claude: 'claude-sonnet-4',
	sonnetThinking: 'claude-3.7-sonnet-thought',
};

export const pollinationsModels = {
	openai: 'openai',
	reasoning: 'openai-reasoning',
};

export const openWebUiModels = {
	gpt5: 'pplx.gpt-5-search',
	grok: 'pplx.grok-4-search',
	o3: 'pplx.o3-search',
	sonnetThinking: 'pplx.claude-4.0-sonnet-think-search',
};

/**
 * Type definitions
 */
export const MODEL_COMMANDS = [
	'/geminiPro',
	'/gemini',
	'/llama',
	'/oss',
	'/gpt',
	'/gpt5',
	'/codex',
	'/perplexity',
	'/perplexityReasoning',
	// '/r1',
	// '/r1online',
	// '/qwen',
	// '/mixtral',
	'/claude',
	// '/geminiPro',
	// '/o3mini',
	'/o4mini',
	// '/grok',
	'/phind',
	'/pplxgpt',
	'/pplxgrok',
	'/pplxo3',
	'/pplxclaude',
	'/polli',
	'/polliReasoning',
	'/isou',
] as const;

/**
 * Available model commands
 */
export type ModelCommand = typeof MODEL_COMMANDS[number];
export const modelCommands = [...MODEL_COMMANDS] as ModelCommand[];

export const WHITELISTED_MODELS: ModelCommand[] = [
	'/llama',
	'/oss',
	'/gpt',
	// '/r1online',
	// '/r1',
	// '/qwen',
	// '/mixtral',
	// '/gemini',
	// '/o3mini',
	// '/grok',
	'/phind',
	'/polli',
	'/polliReasoning',
	'/isou',
];
