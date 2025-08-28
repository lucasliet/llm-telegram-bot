import { InlineKeyboard } from 'grammy';

/**
 * Helper command buttons for inline keyboard - Admin version (all models)
 */
const adminCommandButtons = [
    [['Modelo Atual', '/currentmodel']],
    [
        ['Llama 4 Maverick', '/llama'],
        ['Phind', '/phind'],
        ['Isou', '/isou'],
    ],
    [
        ['Copilot GPT 5 Mini', '/gpt'],
        ['Copilot GPT o4 Mini', '/o4mini'],
    ],
    [
        ['Copilot GPT 5', '/gpt5'],
        ['Copilot Sonnet 4', '/claude'],
    ],
    [
        ['Codex', '/codex'],
        ['GPT OSS 120b', '/oss'],
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
		['Pollinations', '/polli'],
		['Pollinations Reasoning', '/polliReasoning'],
	],
	[
		['Sonar', '/perplexity'],
		['Sonar Reasoning', '/perplexityReasoning'],
	],
	[
		['PPLX GPT 5', '/pplxgpt'],
		['PPLX Grok 4', '/pplxgrok'],
	],
    [
        ['PPLX Sonnet 4', '/pplxclaude'],
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
		['GPT OSS 120b', '/oss'],
		['Isou', '/isou'],
	],
	[
		['Pollinations', '/polli'],
		['Pollinations Reasoning', '/polliReasoning'],
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
		['Copilot GPT 5 Mini', '/gpt'],
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
\\- \`polliImage:\` mensagem \\- Gera imagens com __Pollinations__
\\- \`artaImage:\` mensagem \\- Gera imagens com __Arta__
\\- \`oss:\` mensagem \\- Faz uma pergunta usando o modelo de codigo aberto__GPT OSS 120b__
\\- \`codex:\` mensagem \\- Faz uma pergunta usando o provedor __Codex__
\\- \`gpt:\` mensagem \\- Gera texto com __GPT 5 mini__
\\- \`gpt5:\` mensagem \\- Gera texto com __GPT 5__
\\- \`llama:\` mensagem \\- Gera texto com o __Llama 4 Maverick__
\\- \`sql:\` mensagem \\- Gera sql com modelo __SQL Coder__
\\- \`code:\` mensagem \\- Gera código com modelo __Deepseek Coder__
\\- \`phind:\` mensagem \\- Faz uma pergunta usando o modelo __Phind__ com acesso web
\\- \`isou:\` mensagem \\- Faz uma pergunta usando o modelo __Isou__ com acesso web
\\- \`perplexity:\` mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai
\\- \`search:\` mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai
\\- \`reasonSearch:\` mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai com o uso de __Deepseek\\-R1__
\\- \`claude:\` mensagem \\- Faz uma pergunta usando o modelo __Claude__
\\- \`gemini:\` mensagem \\- Faz uma pergunta usando o modelo __Gemini Flash__
\\- \`geminiPro:\` mensagem \\- Faz uma pergunta usando o modelo __Gemini Pro__
\\- \`o4mini:\` mensagem \\- Faz uma pergunta usando o modelo __o4mini__ pelo __Github Copilot__
\\- \`pgpt:\` mensagem \\- Faz uma pergunta usando o modelo __PPLX GPT 5__ pela __Perplexity__
\\- \`pgrok:\` mensagem \\- Faz uma pergunta usando o modelo __PPLX Grok 4__ pela __Perplexity__
\\- \`po3:\` mensagem \\- Faz uma pergunta usando o modelo __PPLX o3__ pela __Perplexity__
\\- \`pclaude:\` mensagem \\- Faz uma pergunta usando o modelo __PPLX Sonnet 4__ pela __Perplexity__
\\- \`polli:\` mensagem \\- Faz uma pergunta usando o modelo __Pollinations__
\\- \`polliReasoning:\` mensagem \\- Faz uma pergunta usando o modelo __Pollinations Reasoning__
\\- \`fala:\` mensagem \\- Faz uma pergunta usando __Elevenlabs__ para TTS

*Seleção de modelos de linguagem*:`;

/**
 * Help message for regular users (limited commands)
 */
export const userHelpMessage = `*Comandos inline*:
\\- \`phind:\` mensagem \\- Faz uma pergunta usando o modelo __Phind__ com acesso web
\\- \`isou:\` mensagem \\- Faz uma pergunta usando o modelo __Isou__ com acesso web
\\- \`oss:\` mensagem \\- Faz uma pergunta usando o modelo de codigo aberto__GPT OSS 120b__
\\- \`gpt:\` mensagem \\- Gera texto com __GPT 5 mini__
\\- \`llama:\` mensagem \\- Gera texto com o __Llama 4 Maverick__
\\- \`polliImage:\` mensagem \\- Gera imagens com __Pollinations__
\\- \`artaImage:\` mensagem \\- Gera imagens com __Arta__
\\- \`polli:\` mensagem \\- Faz uma pergunta usando o modelo __Pollinations__
\\- \`polliReasoning:\` mensagem \\- Faz uma pergunta usando o modelo __Pollinations Reasoning__

*Seleção de modelos de linguagem*:`;
