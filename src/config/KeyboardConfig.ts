import { InlineKeyboard } from 'grammy';

/**
 * Helper command buttons for inline keyboard - Admin version (all models)
 */
const adminCommandButtons = [
	[['Modelo Atual', '/currentmodel']],
	[
		['Openrouter Free', '/free'],
		['Opencode Free', '/opencode'],
	],
	[['Gemini 3.8 Flash', '/gemini']],
	[
		['GLM 5.3', '/glm'],
		['GLM 5.3 Flash', '/glmflash'],
	],
	[['Limpar Histórico', '/clear']],
];

/**
 * Helper command buttons for inline keyboard - Regular user version (whitelisted models only)
 */
const userCommandButtons = [
	[['Modelo Atual', '/currentmodel']],
	[['Opencode Free', '/opencode']],
	[['Free Models Router', '/free']],
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
\\- \`kimi:\` mensagem \\- Faz uma pergunta usando o modelo __Kimi K2\\.7 Code__ pela __Cloudflare__
\\- \`gpt:\` mensagem \\- Gera texto com __GPT 5 mini__ pelo __Copilot__
\\- \`free:\` mensagem \\- Faz uma pergunta usando o modelo gratuito do *OpenRouter*
\\- \`opencode:\` mensagem \\- Faz uma pergunta usando o modelo gratuito do *OpenCode Zen*
\\- \`gemini:\` mensagem \\- Faz uma pergunta usando o __Gemini 3\\.8 Flash__ pelo __Vertex AI__
\\- \`search:\` mensagem \\- Faz uma pergunta usando o __Sonar__ pela __Perplexity__
\\- \`reasonSearch:\` mensagem \\- Faz uma pergunta usando o __Sonar Reasoning Pro__
\\- \`zai:\` mensagem \\- Faz uma pergunta usando o __GLM 5\\.3 Flash__ pelo __Zai__
\\- \`glm:\` mensagem \\- Faz uma pergunta usando o __GLM 5\\.3__ pelo __Zai__
\\- \`glmflash:\` mensagem \\- Faz uma pergunta usando o __GLM 5\\.3 Flash__ pelo __Zai__
\\- \`fala:\` mensagem \\- Faz uma pergunta usando __Elevenlabs__ para TTS

*Seleção de modelos de linguagem*:`;

/**
 * Help message for regular users (limited commands)
 */
export const userHelpMessage = `*Comandos inline*:
\\- \`free:\` mensagem \\- Faz uma pergunta usando o modelo gratuito do *OpenRouter*
\\- \`opencode:\` mensagem \\- Faz uma pergunta usando o modelo gratuito do *OpenCode Zen*

*Seleção de modelos de linguagem*:`;
