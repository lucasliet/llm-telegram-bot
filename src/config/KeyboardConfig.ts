import { InlineKeyboard } from 'grammy';

/**
 * Helper command buttons for inline keyboard - Admin version (all models)
 */
const adminCommandButtons = [
	[['Modelo Atual', '/currentmodel']],
	[
		['Pollinations', '/polli'],
		['Openrouter Free', '/free'],
	],
	[
		['Gemini 3 Flash', '/antigravity'],
		['Gemini 3 Pro', '/antigeminipro'],
	],
	[
		['GLM 5.2', '/glm'],
		['GLM 5 Turbo', '/glmflash'],
	],
	[['Limpar Histórico', '/clear']],
];

/**
 * Helper command buttons for inline keyboard - Regular user version (whitelisted models only)
 */
const userCommandButtons = [
	[['Modelo Atual', '/currentmodel']],
	[
		['Pollinations', '/polli'],
		['Free Models Router', '/free'],
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
\\- \`polli:\` mensagem \\- Faz uma pergunta usando o modelo __Pollinations__
\\- \`kimi:\` mensagem \\- Faz uma pergunta usando o modelo __Kimi K2\\.7 Code__ pela __Cloudflare__
\\- \`gpt:\` mensagem \\- Gera texto com __GPT 5 mini__ pelo __Copilot__
\\- \`free:\` mensagem \\- Faz uma pergunta usando o modelo gratuito do *OpenRouter*
\\- \`gemini:\` mensagem \\- Faz uma pergunta usando o __Gemini 2\\.5 Flash__ pelo __Vertex AI__
\\- \`geminiPro:\` mensagem \\- Faz uma pergunta usando o __Gemini 2\\.5 Pro__ pelo __Vertex AI__
\\- \`search:\` mensagem \\- Faz uma pergunta usando o __Sonar__ pela __Perplexity__
\\- \`reasonSearch:\` mensagem \\- Faz uma pergunta usando o __Sonar Reasoning Pro__
\\- \`zai:\` mensagem \\- Faz uma pergunta usando o __GLM 4\\.7 Flash__ pelo __Zai__
\\- \`glm:\` mensagem \\- Faz uma pergunta usando o __GLM 4\\.7__ pelo __Zai__
\\- \`glmflash:\` mensagem \\- Faz uma pergunta usando o __GLM 4\\.7 Flash__ pelo __Zai__
\\- \`fala:\` mensagem \\- Faz uma pergunta usando __Elevenlabs__ para TTS

*Seleção de modelos de linguagem*:`;

/**
 * Help message for regular users (limited commands)
 */
export const userHelpMessage = `*Comandos inline*:
\\- \`polli:\` mensagem \\- Faz uma pergunta usando o modelo __Pollinations__
\\- \`free:\` mensagem \\- Faz uma pergunta usando o modelo gratuito do *OpenRouter*

*Seleção de modelos de linguagem*:`;
