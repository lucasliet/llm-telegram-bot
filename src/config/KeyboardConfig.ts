import { InlineKeyboard } from 'grammy';

/**
 * Helper command buttons for inline keyboard - Admin version (all models)
 */
const adminCommandButtons = [
	[['Modelo Atual', '/currentmodel']],
	[
		['Grok 3', '/grok'],
		['Phind', '/phind'],
	],
	[
		['Copilot GPT 4.1', '/gpt'],
		['Copilot GPT o4 Mini', '/o4mini'],
	],
	[
		['Deepseek R1 Online', '/r1'],
		['Deepseek R1', '/r1off'],
	],
	[
		['Llama 4 Maverick', '/llama'],
		['Gemini 2.0 Flash', '/gemini'],
	],
	[
		['Qwen', '/qwen'],
		['Mixtral', '/mixtral'],
	],
	[
		['Claude 3.7 Sonnet', '/claude'],
		['GPT o3 Mini', '/o3mini'],
	],
	[
		['Sonar', '/perplexity'],
		['Sonar Reasoning', '/perplexityReasoning'],
	],
	[['Limpar Histórico', '/clear']],
];

/**
 * Helper command buttons for inline keyboard - Regular user version (whitelisted models only)
 */
const userCommandButtons = [
	[['Modelo Atual', '/currentmodel']],
	[
		['Grok 3', '/grok'],
		['Phind', '/phind'],
	],
	[
		['Deepseek R1 Online', '/r1'],
		['Deepseek R1', '/r1off'],
	],
	[
		['Qwen', '/qwen'],
		['Mixtral', '/mixtral'],
	],
	[
		['Llama 4 Maverick', '/llama'],
		['Gemini 2.0 Flash', '/gemini'],
	],
	[
		['Claude 3.7 Sonnet', '/claude'],
		['GPT o3 Mini', '/o3mini'],
	],
	[['Limpar Histórico', '/clear']],
];

export const adminKeyboard = InlineKeyboard.from(
	adminCommandButtons.map((row) => row.map(([label, data]) => InlineKeyboard.text(label, data))),
);

export const userKeyboard = InlineKeyboard.from(
	userCommandButtons.map((row) => row.map(([label, data]) => InlineKeyboard.text(label, data))),
);

/**
 * Help message for admin users (all commands)
 */
export const adminHelpMessage = `*Comandos inline*:
\\- \`cloudflareImage:\` mensagem \\- Gera imagens com __Stable Diffusion__
\\- \`gptImage:\` mensagem \\- Gera imagens com __DALL\\-e__
\\- \`gpt:\` mensagem \\- Gera texto com __GPT 4o__
\\- \`llama:\` mensagem \\- Gera texto com o __Llama 3\\.3__
\\- \`sql:\` mensagem \\- Gera sql com modelo __SQL Coder__
\\- \`code:\` mensagem \\- Gera código com modelo __Deepseek Coder__
\\- \`phind:\` mensagem \\- Faz uma pergunta usando o modelo __Phind__
\\- \`perplexity:\` mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai
\\- \`search:\` mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai
\\- \`reasonSearch:\` mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai com o uso de __Deepseek\\-R1__
\\- \`r1off:\` mensagem \\- Faz uma pergunta usando o modelo __Deepseek\\-R1__ pela __BlackboxAI__
\\- \`r1:\` mensagem \\- Faz uma pergunta usando o modelo __Deepseek\\-R1__ pela __BlackboxAI__ Online
\\- \`qwen:\` mensagem \\- Faz uma pergunta usando o modelo __Qwen__ pela __BlackboxAI__
\\- \`mixtral:\` mensagem \\- Faz uma pergunta usando o modelo __Mixtral__ pela __BlackboxAI__
\\- \`claude:\` mensagem \\- Faz uma pergunta usando o modelo __Claude__ pela __BlackboxAI__
\\- \`gemini:\` mensagem \\- Faz uma pergunta usando o modelo __Gemini__ pela __BlackboxAI__
\\- \`geminiPro:\` mensagem \\- Faz uma pergunta usando o modelo __GeminiPro__ pela __BlackboxAI__
\\- \`o3mini:\` mensagem \\- Faz uma pergunta usando o modelo __o3mini__ pela __DuckDuckGo__
\\- \`o3high:\` mensagem \\- Faz uma pergunta usando o modelo __o3high__ pela __BlackboxAI__
\\- \`gpt45:\` mensagem \\- Faz uma pergunta usando o modelo __gpt45__ pela __BlackboxAI__
\\- \`o4mini:\` mensagem \\- Faz uma pergunta usando o modelo __o4mini__ pelo __Github Copilot__
\\- \`grok:\` mensagem \\- Faz uma pergunta usando o modelo __Grok 3__ pela __BlackboxAI__
\\- \`fala:\` mensagem \\- Faz uma pergunta usando __Elevenlabs__ para TTS

*Seleção de modelos de linguagem*:`;

/**
 * Help message for regular users (limited commands)
 */
export const userHelpMessage = `*Comandos inline*:
\\- \`gpt:\` mensagem \\- Gera texto com __GPT 4o mini__
\\- \`llama:\` mensagem \\- Gera texto com o __Llama 3\\.3__
\\- \`phind:\` mensagem \\- Faz uma pergunta usando o modelo __Phind__
\\- \`r1off:\` mensagem \\- Faz uma pergunta usando o modelo __Deepseek\\-R1__ pela __BlackboxAI__
\\- \`r1:\` mensagem \\- Faz uma pergunta usando o modelo __Deepseek\\-R1__ pela __BlackboxAI__
\\- \`qwen:\` mensagem \\- Faz uma pergunta usando o modelo __Qwen__ pela __BlackboxAI__
\\- \`mixtral:\` mensagem \\- Faz uma pergunta usando o modelo __Mixtral__ pela __BlackboxAI__
\\- \`claude:\` mensagem \\- Faz uma pergunta usando o modelo __Claude__ pela __BlackboxAI__
\\- \`gemini:\` mensagem \\- Faz uma pergunta usando o modelo __Gemini__ pela __BlackboxAI__
\\- \`o3mini:\` mensagem \\- Faz uma pergunta usando o modelo __o3mini__ pela __DuckDuckGo__
\\- \`grok:\` mensagem \\- Faz uma pergunta usando o modelo __Grok 3__ pela __BlackboxAI__
\\- \`cloudflareImage:\` mensagem \\- Gera imagens com __Stable Diffusion__

*Seleção de modelos de linguagem*:`;
