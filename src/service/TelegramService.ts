import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import { Voice } from 'https://deno.land/x/grammy@v1.17.2/types.deno.ts';

import {
	getCurrentModel,
	setCurrentModel,
} from '../repository/ChatRepository.ts';

import {
	ModelCommand,
	modelCommands,
	WHITELISTED_MODELS,
} from '../config/models.ts';

import {
	handleBlackbox,
	handleCloudflare,
	handleGemini,
	handleOpenAI,
	handlePerplexity,
	handlePuter,
} from '../handlers/models/index.ts';

import { FileUtils } from '../util/FileUtils.ts';

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
			'/gpt': () => handleOpenAI(ctx, `gpt: ${message}`),
			'/perplexity': () => handlePerplexity(ctx, `perplexity: ${message}`),
			'/perplexityReasoning': () =>handlePerplexity(ctx, `perplexityReasoning: ${message}`),
			'/llama': () => handleCloudflare(ctx, `llama: ${message!}`),
			'/r1': () => handleBlackbox(ctx, `r1: ${message}`),
			'/r1off': () => handleBlackbox(ctx, `r1off: ${message}`),
			'/mixtral': () => handleBlackbox(ctx, `mixtral: ${message}`),
			'/qwen': () => handleBlackbox(ctx, `qwen: ${message}`),
			'/claude': () => handleBlackbox(ctx, `claude: ${message}`),
			'/geminiPro': () => handleBlackbox(ctx, `geminiPro: ${message}`),
			'/gemini': () => handleBlackbox(ctx, `gemini: ${message}`),
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

	callBlackboxModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handleBlackbox(ctx, commandMessage);
	},

	callPuterModel(ctx: Context, commandMessage?: string): Promise<void> {
		return handlePuter(ctx, commandMessage);
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
	text: string
): Promise<void> {
	const audioFile = await FileUtils.textToSpeech(text);

	ctx.replyWithVoice(audioFile, {
		reply_to_message_id: ctx.message?.message_id,
	});
};
