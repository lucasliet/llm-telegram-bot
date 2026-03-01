import { InlineKeyboard } from 'grammy';

/**
 * Helper command buttons for inline keyboard - Admin version (all models)
 */
const adminCommandButtons = [
	[['⚙️ Modelo Atual', '/currentmodel']],
	[
		['Pollinations', '/polli'],
		['Copilot GPT 5 Mini', '/gpt'],
	],
	[
		['Llama 4 Maverick', '/llama'],
		['GPT OSS 120b', '/oss'],
	],
	[
		['Gemini 3 Flash', '/antigravity'],
		['Gemini 3 Pro', '/antigeminipro'],
	],
	[
		['GLM 4.7', '/glm'],
		['GLM 4.7 Flash', '/glmflash'],
	],
	[['🗑️ Limpar Histórico', '/clear'], ['🔔 Notificações', '/notifications']],
];

/**
 * Helper command buttons for inline keyboard - Regular user version (whitelisted models only)
 */
const userCommandButtons = [
	[['⚙️ Modelo Atual', '/currentmodel']],
	[
		['Pollinations', '/polli'],
		['Copilot GPT 5 Mini', '/gpt'],
	],
	[
		['Llama 4 Maverick', '/llama'],
		['GPT OSS 120b', '/oss'],
	],
	[['🗑️ Limpar Histórico', '/clear'], ['🔔 Notificações', '/notifications']],
];

/**
 * Settings keyboard sections with emoji icons for all items
 */
const settingsButtons = [
	[['⚙️ Modelo Atual', '/currentmodel'], ['🔔 Notificações', '/notifications']],
	[['🎨 Aparência', '/appearance'], ['ℹ️ Sobre', '/about']],
	[['🗑️ Limpar Histórico', '/clear']],
];

export const adminKeyboard = InlineKeyboard.from(
	adminCommandButtons.map((row) => row.map(([label, data]) => InlineKeyboard.text(label, data))),
);

export const userKeyboard = InlineKeyboard.from(
	userCommandButtons.map((row) => row.map(([label, data]) => InlineKeyboard.text(label, data))),
);

export const settingsKeyboard = InlineKeyboard.from(
	settingsButtons.map((row) => row.map(([label, data]) => InlineKeyboard.text(label, data))),
);

/**
 * Help message for admin users (all commands)
 */
export const adminHelpMessage = `*Comandos inline*:
\\- \`cloudflareImage:\` mensagem \\- Gera imagens com __Stable Diffusion__
\\- \`gptImage:\` mensagem \\- Gera imagens com __DALL\\-e__
\\- \`polliImage:\` mensagem \\- Gera imagens com __Pollinations__
\\- \`artaImage:\` mensagem \\- Gera imagens com __Arta__
\\- \`oss:\` mensagem \\- Faz uma pergunta usando o modelo __GPT OSS 120b__
\\- \`gpt:\` mensagem \\- Gera texto com __GPT 5 mini__ pelo __Copilot__
\\- \`gpt5:\` mensagem \\- Gera texto com __GPT 5\\.2__ pelo __Copilot__
\\- \`claude:\` mensagem \\- Faz uma pergunta usando o __Claude Sonnet 4\\.5__ pelo __Copilot__
\\- \`llama:\` mensagem \\- Gera texto com o __Llama 4 Maverick__
\\- \`gemini:\` mensagem \\- Faz uma pergunta usando o __Gemini 2\\.5 Flash__ pelo __Vertex AI__
\\- \`geminiPro:\` mensagem \\- Faz uma pergunta usando o __Gemini 2\\.5 Pro__ pelo __Vertex AI__
\\- \`perplexity:\` mensagem \\- Faz uma pergunta usando o __Sonar__ pela __Perplexity__
\\- \`search:\` mensagem \\- Faz uma pergunta usando o __Sonar__ pela __Perplexity__
\\- \`reasonSearch:\` mensagem \\- Faz uma pergunta usando o __Sonar Reasoning Pro__
\\- \`pgpt:\` mensagem \\- Faz uma pergunta usando o __PPLX GPT 5__ pela __Perplexity__
\\- \`pgrok:\` mensagem \\- Faz uma pergunta usando o __PPLX Grok 4__ pela __Perplexity__
\\- \`po3:\` mensagem \\- Faz uma pergunta usando o __PPLX o3__ pela __Perplexity__
\\- \`pclaude:\` mensagem \\- Faz uma pergunta usando o __PPLX Sonnet 4__ pela __Perplexity__
\\- \`polli:\` mensagem \\- Faz uma pergunta usando o __Pollinations__
\\- \`polliReasoning:\` mensagem \\- Faz uma pergunta usando o __Pollinations Reasoning__
\\- \`antigravity:\` mensagem \\- Faz uma pergunta usando o __Gemini 3 Flash__ pelo __Antigravity__
\\- \`antigemini:\` mensagem \\- Faz uma pergunta usando o __Gemini 3 Flash__ pelo __Antigravity__
\\- \`antigeminipro:\` mensagem \\- Faz uma pergunta usando o __Gemini 3 Pro__ pelo __Antigravity__
\\- \`zai:\` mensagem \\- Faz uma pergunta usando o __GLM 4\\.7 Flash__ pelo __Zai__
\\- \`glm:\` mensagem \\- Faz uma pergunta usando o __GLM 4\\.7__ pelo __Zai__
\\- \`glmflash:\` mensagem \\- Faz uma pergunta usando o __GLM 4\\.7 Flash__ pelo __Zai__
\\- \`fala:\` mensagem \\- Faz uma pergunta usando __Elevenlabs__ para TTS

*Seleção de modelos de linguagem*:`;

/**
 * Help message for regular users (limited commands)
 */
export const userHelpMessage = `*Comandos inline*:
\\- \`oss:\` mensagem \\- Faz uma pergunta usando o modelo de codigo aberto__GPT OSS 120b__
\\- \`gpt:\` mensagem \\- Gera texto com __GPT 5 mini__
\\- \`llama:\` mensagem \\- Gera texto com o __Llama 4 Maverick__
\\- \`polli:\` mensagem \\- Faz uma pergunta usando o modelo __Pollinations__

*Seleção de modelos de linguagem*:`;

/**
 * About message with bot information
 */
export const aboutMessage = `ℹ️ *Sobre*

Bot de IA para Telegram com suporte a múltiplos provedores de linguagem\\.

Acesse: [@llm\\_gemini\\_bot](https://t.me/llm_gemini_bot)`;
