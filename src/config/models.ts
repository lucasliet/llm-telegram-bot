export const geminiModels = {
	geminiPro: 'gemini-2.5-pro-preview-06-05',
	geminiFlash: 'gemini-2.5-flash',
};

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
	sttModel: '@cf/openai/whisper-large-v3-turbo',
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
	gpt41: 'gpt-4.1',
	claude: 'claude-sonnet-4',
	sonnetThinking: 'claude-3.7-sonnet-thought',
}

export const openWebUiModels = {
	gpt45: 'pplx.gpt-4.5-search',
	grok: 'pplx.grok-3-beta-search'
}

/**
 * Type definitions
 */
export type ModelCommand =
	| '/geminiPro'
	| '/gemini'
	| '/llama'
	| '/gpt'
	| '/perplexity'
	| '/perplexityReasoning'
	// | '/r1'
	// | '/r1online'
	// | '/qwen'
	// | '/mixtral'
	| '/claude'
	// | '/geminiPro'
	// | '/o3mini'
	| '/o4mini'
	// | '/grok'
	| '/phind'
	| '/pplxgpt'
	| '/pplxgrok';

/**
 * Available model commands
 */
export const modelCommands: ModelCommand[] = [
	'/geminiPro',
	'/gemini',
	'/llama',
	'/gpt',
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
	'/pplxgrok'
];

export const WHITELISTED_MODELS: ModelCommand[] = [
	'/llama',
	// '/r1online',
	// '/r1',
	// '/qwen',
	// '/mixtral',
	'/gemini',
	// '/o3mini',
	// '/grok',
	'/phind',
];
