import { InlineKeyboard } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';

/**
 * Helper command buttons for inline keyboard - Admin version (all models)
 */
const adminCommandButtons = [
	[
		['Modelo Atual', '/currentmodel'],
		['GPT', '/gpt'],
	],
	[
		['Deepseek R1 Online', '/r1'],
		['Deepseek R1', '/r1off'],
	],
	[
		['Llama', '/llama'],
		['Gemini', '/gemini'],
	],
	[
		['Qwen', '/qwen'],
		['Mixtral', '/mixtral'],
	],
	[
		['Perplexity', '/perplexity'],
		['Perplexity Reasoning', '/perplexityReasoning'],
	],
	[['Limpar Histórico', '/clear']],
];

/**
 * Helper command buttons for inline keyboard - Regular user version (whitelisted models only)
 */
const userCommandButtons = [
	[
		['Modelo Atual', '/currentmodel'],
		['GPT', '/gpt'],
	],
	[
		['Deepseek R1 Online', '/r1'],
		['Deepseek R1', '/r1off'],
	],
	[
		['Qwen Online', '/qwen'],
		['Mixtral Online', '/mixtral'],
	],
	[
		['Llama', '/llama'],
		['Limpar Histórico', '/clear']
	],
];

export const adminKeyboard = InlineKeyboard.from(
	adminCommandButtons.map((row) =>
		row.map(([label, data]) => InlineKeyboard.text(label, data))
	),
);

export const userKeyboard = InlineKeyboard.from(
	userCommandButtons.map((row) =>
		row.map(([label, data]) => InlineKeyboard.text(label, data))
	),
);

/**
 * Help message for admin users (all commands)
 */
export const adminHelpMessage = `*Comandos inline*:
\\- \`cloudflareImage:\` mensagem \\- Gera imagens com __Stable Diffusion__
\\- \`gptImage:\` mensagem \\- Gera imagens com __DALL\\-e__
\\- \`gpt:\` mensagem \\- Gera texto com __GPT 4o mini__
\\- \`llama:\` mensagem \\- Gera texto com o __Llama 3\\.3__
\\- \`sql:\` mensagem \\- Gera sql com modelo __SQL Coder__
\\- \`code:\` mensagem \\- Gera código com modelo __Deepseek Coder__
\\- \`perplexity:\` mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai
\\- \`search:\` mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai
\\- \`reasonSearch:\` mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai com o uso de __Deepseek\\-R1__
\\- \`r1off:\` mensagem \\- Faz uma pergunta usando o modelo __Deepseek\\-R1__ pela __BlackboxAI__
\\- \`r1:\` mensagem \\- Faz uma pergunta usando o modelo __Deepseek\\-R1__ pela __BlackboxAI__ Online
\\- \`qwen:\` mensagem \\- Faz uma pergunta usando o modelo __Qwen__ pela __BlackboxAI__
\\- \`mixtral:\` mensagem \\- Faz uma pergunta usando o modelo __Mixtral__ pela __BlackboxAI__
\\- \`puter:\` mensagem \\- Faz uma pergunta usando o modelo __Claude__ pela __PuterAI__
\\- \`claude:\` mensagem \\- Faz uma pergunta usando o modelo __Claude__ pela __PuterAI__

*Seleção de modelos de linguagem*:`;

/**
 * Help message for regular users (limited commands)
 */
export const userHelpMessage = `*Comandos inline*:
\\- \`gpt:\` mensagem \\- Gera texto com __GPT 4o mini__
\\- \`llama:\` mensagem \\- Gera texto com o __Llama 3\\.3__
\\- \`r1off:\` mensagem \\- Faz uma pergunta usando o modelo __Deepseek\\-R1__ pela __BlackboxAI__
\\- \`r1:\` mensagem \\- Faz uma pergunta usando o modelo __Deepseek\\-R1__ pela __BlackboxAI__
\\- \`qwen:\` mensagem \\- Faz uma pergunta usando o modelo __Qwen__ pela __BlackboxAI__
\\- \`mixtral:\` mensagem \\- Faz uma pergunta usando o modelo __Mixtral__ pela __BlackboxAI__
\\- \`cloudflareImage:\` mensagem \\- Gera imagens com __Stable Diffusion__

*Seleção de modelos de linguagem*:`;
