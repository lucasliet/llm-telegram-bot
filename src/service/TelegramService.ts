import { Context } from 'grammy';
import { Voice } from 'grammy-types';

import { getCurrentModel, setCurrentModel } from '@/repository/ChatRepository.ts';

import { ModelCommand, modelCommands, WHITELISTED_MODELS } from '@/config/models.ts';
import { escapeMarkdownV1 } from '@/util/MarkdownUtils.ts';

import {
	handleAntigravity,
	handleArta,
	handleCloudflare,
	handleFala,
	handleGemini,
	handleGithubCopilot,
	handleOpenAI,
	handleOpenRouter,
	handleOpenWebUI,
	handlePerplexity,
	handlePollinations,
	handleVertex,
	handleZai,
} from '@/handlers/index.ts';

import { FileUtils } from '@/util/FileUtils.ts';
import GithubCopilotService from './openai/GithubCopilotService.ts';

const TOKEN = Deno.env.get('BOT_TOKEN') as string;
const ADMIN_USER_IDS: number[] = (Deno.env.get('ADMIN_USER_IDS') as string)
	.split('|')
	.map((id) => parseInt(id));

/**
 * Helper to keep Deno job alive during long-running requests
 * @returns Interval ID
 */
function keepDenoJobAlive(): number {
	return setInterval(() => true, 2000);
}

/**
 * Service for handling Telegram bot interactions
 */
export default {
	/**
	 * Sets the webhook URL for the Telegram bot
	 * @returns Response from Telegram API
	 */
	setWebhook(): Promise<Response> {
		console.log('Setting webhook...');
		return fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				url: 'https://llm-telegram-bot.deno.dev/webhook',
			}),
		});
	},

	/**
	 * Calls a model function if the user is an admin, otherwise defaults to text content
	 * @param ctx - Telegram context
	 * @param modelCallFunction - Function to call for the specific model
	 */
	callAdminModel(
		ctx: Context,
		modelCallFunction: (ctx: Context) => Promise<void>,
	): void {
		const userId = ctx.from?.id;
		if (userId && ADMIN_USER_IDS.includes(userId)) {
			this.callModel(ctx, modelCallFunction);
		} else {
			this.callModel(ctx, this.replyTextContent);
		}
	},

	/**
	 * Generic model call handler with timeout and logging
	 * @param ctx - Telegram context
	 * @param modelCallFunction - Function to call for the specific model
	 */
	callModel(
		ctx: Context,
		modelCallFunction: (ctx: Context) => Promise<void>,
	): void {
		console.info(`user: ${ctx.msg?.from?.id}, message: ${ctx.message?.text}`);

		const startTime = Date.now();
		const keepAliveId = keepDenoJobAlive();
		const typingId = ctx.startTypingIndicator();

		modelCallFunction(ctx)
			.then(() => {
				ctx.chatAction = undefined;
				clearInterval(typingId);
				clearInterval(keepAliveId);
				console.log(`Request processed in ${Date.now() - startTime}ms`);
			})
			.catch((err) => {
				ctx.chatAction = undefined;
				clearInterval(typingId);
				clearInterval(keepAliveId);
				console.error(err);
				ctx.reply(`Eita, algo deu errado: ${err.message}`, {
					reply_to_message_id: ctx.msg?.message_id,
				});
			});
	},

	/**
	 * Retrieves and sends GitHub Copilot usage information to the user if the user is an admin.
	 * @param ctx - The Telegram context.
	 * @returns A promise that resolves when the usage information has been sent.
	 */
	async getUsage(ctx: Context): Promise<any> {
		const { userId } = await ctx.extractContextKeys();
		if (!userId || !ADMIN_USER_IDS.includes(userId)) return;

		const data = await getUsage();

		const quotas = (data as any).quota_snapshots ?? {};
		const chat = quotas.chat as Quota | undefined;
		const completions = quotas.completions as Quota | undefined;
		const premium = quotas.premium_interactions as Quota | undefined;

		const formatted = `🤖
GitHub Copilot - Status de Uso

📋
Informações Gerais:
• *Plano*: ${escapeMarkdownV1((data as any).copilot_plan ?? 'n/a')}
• *Tipo de acesso*: ${escapeMarkdownV1((data as any).access_type_sku ?? 'n/a')}
• *Chat habilitado*: ${(data as any).chat_enabled ? 'Sim' : 'Não'}
• *Data de atribuição*: ${formatDate((data as any).assigned_date)}
• *Próxima renovação de cota*: ${formatDate((data as any).quota_reset_date)}

📊
Cotas de Uso:

🗨️
Chat:
• *Status*: ${formatQuota(chat)}
• *Overage permitido*: ${chat?.overage_permitted ? 'Sim' : 'Não'}
• *Contador de overage*: ${chat?.overage_count ?? 0}

💡
Completions (Autocompletar):
• *Status*: ${formatQuota(completions)}
• *Overage permitido*: ${completions?.overage_permitted ? 'Sim' : 'Não'}
• *Contador de overage*: ${completions?.overage_count ?? 0}

⭐
Interações Premium:
• *Status*: ${formatQuota(premium)}
• *Overage permitido*: ${premium?.overage_permitted ? 'Sim' : 'Não'}
• *Contador de overage*: ${premium?.overage_count ?? 0}`;

		ctx.reply(formatted, { parse_mode: 'Markdown' });
	},

	/**
	 * Returns admin IDs if the requesting user is an admin
	 * @param ctx - Telegram context
	 * @returns Array of admin user IDs
	 */
	async getAdminIds(ctx: Context): Promise<number[]> {
		const { userId } = await ctx.extractContextKeys();
		if (userId && ADMIN_USER_IDS.includes(userId)) return ADMIN_USER_IDS;
		return [];
	},

	/**
	 * Gets the current model for the user
	 * @param ctx - Telegram context
	 * @returns Current model command
	 */
	async getCurrentModel(ctx: Context): Promise<ModelCommand> {
		const { userKey } = await ctx.extractContextKeys();
		return getCurrentModel(userKey);
	},

	/**
	 * Sets the current model for the user
	 * @param ctx - Telegram context
	 */
	async setCurrentModel(ctx: Context): Promise<void> {
		console.info(`user: ${ctx.msg?.from?.id}, message: ${ctx.message?.text}`);
		const {
			userId,
			userKey,
			contextMessage: message,
		} = await ctx.extractContextKeys();

		const command = (message || ctx.callbackQuery?.data) as ModelCommand;

		const isValidCommand = modelCommands.includes(command);
		const isAuthorizedUser = (userId && ADMIN_USER_IDS.includes(userId)) || WHITELISTED_MODELS.includes(command);

		if (!isValidCommand || !isAuthorizedUser) return;

		await setCurrentModel(userKey, command);
		ctx.reply(`Novo modelo de inteligência escolhido: ${command}`);
	},

	/**
	 * Replies with text content based on the user's selected model
	 * @param ctx - Telegram context
	 */
	async replyTextContent(ctx: Context): Promise<void> {
		const { userKey, contextMessage: message } = await ctx.extractContextKeys();
		const currentModel = await getCurrentModel(userKey);

		const modelHandlers: Record<ModelCommand, () => Promise<void>> = {
			'/polli': () => handlePollinations(ctx, `polli: ${message}`),
			'/gpt': () => handleGithubCopilot(ctx, `gpt: ${message}`),
			'/oss': () => handleCloudflare(ctx, `oss: ${message}`),
			'/llama': () => handleOpenRouter(ctx, `llama: ${message!}`),
			'/gemini': () => handleVertex(ctx, `gemini: ${message}`),
			'/geminiPro': () => handleVertex(ctx, `geminiPro: ${message}`),
			'/antigravity': () => handleAntigravity(ctx, `antigravity: ${message}`),
			'/antigeminipro': () => handleAntigravity(ctx, `antigeminipro: ${message}`),
			'/zai': () => handleZai(ctx, `zai: ${message}`),
			'/glm': () => handleZai(ctx, `glm: ${message}`),
			'/glmflash': () => handleZai(ctx, `glmflash: ${message}`),
		};

		const handler = modelHandlers[currentModel];

		if (handler) {
			await handler();
		} else {
			ctx.reply('Modelo de inteligência não encontrado.', {
				reply_to_message_id: ctx.message?.message_id,
			});
		}
	},

	callPerplexityModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handlePerplexity(ctx, commandMessage);
	},
	callOpenAIModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleOpenAI(ctx, commandMessage);
	},
	callCloudflareModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleCloudflare(ctx, commandMessage);
	},
	callOpenRouterModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleOpenRouter(ctx, commandMessage);
	},
	callGithubCopilotModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleGithubCopilot(ctx, commandMessage);
	},
	callOpenWebUIModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleOpenWebUI(ctx, commandMessage);
	},
	callGeminiModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleGemini(ctx, commandMessage);
	},
	callPollinationsModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handlePollinations(ctx, commandMessage);
	},
	callVertexModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleVertex(ctx, commandMessage);
	},
	callArtaModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleArta(ctx, commandMessage);
	},
	callFala(ctx: Context, commandMessage?: string): Promise<void> {
		return handleFala(ctx, new GithubCopilotService(), commandMessage);
	},
	callAntigravityModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleAntigravity(ctx, commandMessage);
	},
	callZaiModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleZai(ctx, commandMessage);
	},
};

export const downloadTelegramFile = FileUtils.downloadTelegramFile;
export const transcribeAudio = (
	userId: number,
	userKey: string,
	ctx: Context,
	audio: Voice,
): Promise<string> => {
	return FileUtils.transcribeAudio(userId, userKey, ctx, audio);
};

export async function textToSpeech(ctx: Context, text: string): Promise<void> {
	const audioFile = await FileUtils.textToSpeech(text);

	ctx.replyWithVoice(audioFile, {
		reply_to_message_id: ctx.message?.message_id,
	});
}

/**
 * Retrieves Copilot usage information if the requesting user is an admin.
 * @param ctx - Telegram context.
 * @returns A promise that resolves to the Copilot usage data or an empty object if not authorized.
 */
export async function getUsage() {
	const url = 'https://api.github.com/copilot_internal/user';
	const headers: Record<string, string> = {
		Accept: 'application/json',
		Authorization: `token ${Deno.env.get('COPILOT_GITHUB_TOKEN')}`,
		'Editor-Version': 'vscode/1.98.1',
		'Editor-Plugin-Version': 'copilot-chat/0.26.7',
		'User-Agent': 'GitHubCopilotChat/0.26.7',
		'X-Github-Api-Version': '2025-04-01',
	};

	const res = await fetch(url, { headers });
	const text = await res.text();
	if (!res.ok) {
		let body: any;
		try {
			body = JSON.parse(text);
		} catch {
			body = text;
		}
		throw new Error(`Copilot API error ${res.status}: ${JSON.stringify(body)}`);
	}

	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

/**
 * Formats a date value into a localized string (pt-BR).
 * @param value - The date value to format. Can be a string, number, Date object, or undefined/null.
 * @returns The formatted date string, or 'n/a' if the value is null/undefined, or the original string if parsing fails.
 */
function formatDate(value: string | number | Date | undefined | null): string {
	if (!value) return 'n/a';
	try {
		const d = new Date(value as any);
		if (isNaN(d.getTime())) return String(value);
		return d.toLocaleString('pt-BR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return String(value);
	}
}

type Quota = {
	unlimited?: boolean;
	entitlement?: number;
	remaining?: number;
	percent_remaining?: number;
	overage_permitted?: boolean;
	overage_count?: number;
};

/**
 * Formats a Quota object into a human-readable string.
 * @param q - The Quota object to format.
 * @returns A string representing the quota status, e.g., 'Ilimitado', 'Usadas X de Y (Z% restante)', or 'n/a'.
 */
function formatQuota(q: Quota | undefined): string {
	if (!q) return 'n/a';
	if (q.unlimited) return 'Ilimitado';
	const entitlement = q.entitlement ?? 0;
	const remaining = q.remaining ?? 0;
	if (entitlement > 0) {
		const used = Math.max(0, entitlement - remaining);
		const percent = Math.max(0, Math.min(100, (remaining / entitlement) * 100));
		return `Usadas ${used} de ${entitlement} (${percent.toFixed(0)}% restante)`;
	}
	if (typeof q.percent_remaining === 'number') {
		return `${q.percent_remaining.toFixed(2)}% restante`;
	}
	return 'n/a';
}
