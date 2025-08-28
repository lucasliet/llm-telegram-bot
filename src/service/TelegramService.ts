import { Context } from 'grammy-context';
import { Voice } from 'grammy-types';

import { getCurrentModel, setCurrentModel } from '@/repository/ChatRepository.ts';

import { ModelCommand, modelCommands, WHITELISTED_MODELS } from '@/config/models.ts';

import {
	handleArta,
	handleBlackbox,
	handleCloudflare,
	handleCodex,
	handleDuckDuckGo,
	handleGemini,
	handleGithubCopilot,
	handleIsou,
	handleOpenAI,
	handleOpenRouter,
	handleOpenWebUI,
	handlePerplexity,
	handlePhind,
	handlePollinations,
	handlePuter,
} from '@/handlers/index.ts';

import { FileUtils } from '@/util/FileUtils.ts';

const TOKEN = Deno.env.get('BOT_TOKEN') as string;
const ADMIN_USER_IDS: number[] = (Deno.env.get('ADMIN_USER_IDS') as string)
	.split('|').map((id) => parseInt(id));

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
		const userId = ctx.from?.id!;
		if (ADMIN_USER_IDS.includes(userId)) {
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
		const timeoutId = ctx.replyOnLongAnswer();

		modelCallFunction(ctx)
			.then(() => {
				clearTimeout(timeoutId);
				clearInterval(keepAliveId);
				console.log(`Request processed in ${Date.now() - startTime}ms`);
			})
			.catch((err) => {
				clearTimeout(timeoutId);
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
		if (ADMIN_USER_IDS.includes(userId!)) {
			const data = await getUsage();

			const quotas = (data as any).quota_snapshots ?? {};
			const chat = quotas.chat as Quota | undefined;
			const completions = quotas.completions as Quota | undefined;
			const premium = quotas.premium_interactions as Quota | undefined;

			const formatted = `🤖 
GitHub Copilot - Status de Uso

📋 
Informações Gerais:
• *Plano*: ${(data as any).copilot_plan ?? 'n/a'}
• *Tipo de acesso*: ${(data as any).access_type_sku?.replaceAll('_', '\\_') ?? 'n/a'}
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
		}
	},

	/**
	 * Returns admin IDs if the requesting user is an admin
	 * @param ctx - Telegram context
	 * @returns Array of admin user IDs
	 */
	async getAdminIds(ctx: Context): Promise<number[]> {
		const { userId } = await ctx.extractContextKeys();
		if (ADMIN_USER_IDS.includes(userId!)) return ADMIN_USER_IDS;
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
		const { userId, userKey, contextMessage: message } = await ctx
			.extractContextKeys();

		const command = (message || ctx.callbackQuery?.data) as ModelCommand;

		const isValidCommand = modelCommands.includes(command);
		const isAuthorizedUser = ADMIN_USER_IDS.includes(userId!) ||
			WHITELISTED_MODELS.includes(command);

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
			'/gpt': () => handleGithubCopilot(ctx, `gpt: ${message}`),
			'/gpt5': () => handleGithubCopilot(ctx, `gpt5: ${message}`),
			'/codex': () => handleCodex(ctx, `codex: ${message}`),
			'/perplexity': () => handlePerplexity(ctx, `perplexity: ${message}`),
			'/perplexityReasoning': () => handlePerplexity(ctx, `perplexityReasoning: ${message}`),
			'/oss': () => handleCloudflare(ctx, `oss: ${message}`),
			'/llama': () => handleOpenRouter(ctx, `llama: ${message!}`),
			// '/r1': () => handleBlackbox(ctx, `r1: ${message}`),
			// '/r1online': () => handleBlackbox(ctx, `r1online: ${message}`),
			// '/mixtral': () => handleBlackbox(ctx, `mixtral: ${message}`),
			// '/qwen': () => handleBlackbox(ctx, `qwen: ${message}`),
			'/claude': () => handleGithubCopilot(ctx, `claude: ${message}`),
			'/geminiPro': () => handleGemini(ctx, `geminiPro: ${message}`),
			'/gemini': () => handleGemini(ctx, `gemini: ${message}`),
			// '/o3mini': () => handleDuckDuckGo(ctx, `duck: ${message}`),
			'/o4mini': () => handleGithubCopilot(ctx, `o4mini: ${message}`),
			// '/grok': () => handleBlackbox(ctx, `grok: ${message}`),
			'/phind': () => handlePhind(ctx, `phind: ${message}`),
			'/isou': () => handleIsou(ctx, `isou: ${message}`),
			'/pplxgpt': () => handleOpenWebUI(ctx, `pgpt: ${message}`),
			'/pplxgrok': () => handleOpenWebUI(ctx, `pgrok: ${message}`),
			'/pplxclaude': () => handleOpenWebUI(ctx, `pclaude: ${message}`),
			'/pplxo3': () => handleOpenWebUI(ctx, `po3: ${message}`),
			'/polli': () => handlePollinations(ctx, `polli: ${message}`),
			'/polliReasoning': () => handlePollinations(ctx, `polliReasoning: ${message}`),
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
		const fn = (globalThis as any).handleOpenAI || handleOpenAI;
		return fn(ctx, commandMessage);
	},

	callCloudflareModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleCloudflare(ctx, commandMessage);
	},

	callBlackboxModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleBlackbox(ctx, commandMessage);
	},

	callOpenRouterModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleOpenRouter(ctx, commandMessage);
	},

	callPuterModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handlePuter(ctx, commandMessage);
	},

	callDuckDuckGoModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleDuckDuckGo(ctx, commandMessage);
	},

	callGithubCopilotModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleGithubCopilot(ctx, commandMessage);
	},

	callCodexModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleCodex(ctx, commandMessage);
	},

	callPhindModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handlePhind(ctx, commandMessage);
	},

	callIsouModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleIsou(ctx, commandMessage);
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
	callArtaModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleArta(ctx, commandMessage);
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

export async function textToSpeech(
	ctx: Context,
	text: string,
): Promise<void> {
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
		'Accept': 'application/json',
		'Authorization': `token ${Deno.env.get('COPILOT_TOKEN')}`,
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
