import { InlineKeyboard } from 'grammy';

/**
 * Helper command buttons for inline keyboard - Admin version (all models)
 */
const adminCommandButtons = [
	[['Modelo Atual', '/currentmodel']],
	[
		['Llama 4 Maverick', '/llama'],
		['Phind', '/phind'],
	],
	[
		['Copilot GPT 4.1', '/gpt'],
		['Copilot GPT o4 Mini', '/o4mini'],
	],
	[
		['Copilot Sonnet 4', '/claude'],
	],
	[
		// ['Grok 3', '/grok'],
		// ['GPT o3 Mini', '/o3mini'],
	],
	[
		// ['Deepseek R1', '/r1'],
		// ['Gemini 2.5 Pro', '/geminiPro'],
	],
	[
		['Gemini 2.5 Flash', '/gemini'],
		['Gemini 2.5 Pro', '/geminiPro'],
	],
	[
		// ['Qwen', '/qwen'],
		// ['Mixtral', '/mixtral'],
	],
	[
		['Sonar', '/perplexity'],
		['Sonar Reasoning', '/perplexityReasoning'],
	],
	[
		['PPLX GPT 4.5', '/pplxgpt'],
		['PPLX Grok 3', '/pplxgrok'],
	],
	[['Limpar Histórico', '/clear']],
];

/**
 * Helper command buttons for inline keyboard - Regular user version (whitelisted models only)
 */
const userCommandButtons = [
	[['Modelo Atual', '/currentmodel']],
	[
		['Phind', '/phind'],
		// ['GPT o3 Mini', '/o3mini'],
	],
	[
		// ['Deepseek R1', '/r1'],
		// ['Grok 3', '/grok'],
	],
	[
		// ['Qwen', '/qwen'],
		// ['Mixtral', '/mixtral'],
	],
	[
		['Llama 4 Maverick', '/llama'],
		['Gemini 2.5 Flash', '/gemini'],
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
\\- \`gpt:\` mensagem \\- Gera texto com __GPT 4\\.1__
\\- \`llama:\` mensagem \\- Gera texto com o __Llama 4 Maverick__
\\- \`sql:\` mensagem \\- Gera sql com modelo __SQL Coder__
\\- \`code:\` mensagem \\- Gera código com modelo __Deepseek Coder__
\\- \`phind:\` mensagem \\- Faz uma pergunta usando o modelo __Phind__ com acesso web
\\- \`perplexity:\` mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai
\\- \`search:\` mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai
\\- \`reasonSearch:\` mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai com o uso de __Deepseek\\-R1__
\\- \`claude:\` mensagem \\- Faz uma pergunta usando o modelo __Claude__
\\- \`gemini:\` mensagem \\- Faz uma pergunta usando o modelo __Gemini Flash__
\\- \`geminiPro:\` mensagem \\- Faz uma pergunta usando o modelo __Gemini Pro__
\\- \`o4mini:\` mensagem \\- Faz uma pergunta usando o modelo __o4mini__ pelo __Github Copilot__
\\- \`pgpt:\` mensagem \\- Faz uma pergunta usando o modelo __PPLX GPT 4\\.5__ pela __Perplexity__
\\- \`pgrok:\` mensagem \\- Faz uma pergunta usando o modelo __PPLX Grok 3__ pela __Perplexity__
\\- \`fala:\` mensagem \\- Faz uma pergunta usando __Elevenlabs__ para TTS

*Seleção de modelos de linguagem*:`;

/**
 * Help message for regular users (limited commands)
 */
export const userHelpMessage = `*Comandos inline*:
\\- \`phind:\` mensagem \\- Faz uma pergunta usando o modelo __Phind__ com acesso web
\\- \`llama:\` mensagem \\- Gera texto com o __Llama 4 Maverick__
\\- \`gemini:\` mensagem \\- Faz uma pergunta usando o modelo __Gemini Flash__

*Seleção de modelos de linguagem*:`;
