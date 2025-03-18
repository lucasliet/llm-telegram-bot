import { Application } from 'https://deno.land/x/oak@v12.6.1/mod.ts';
import { oakCors } from 'https://deno.land/x/cors@v1.2.2/mod.ts';
import {
	Bot,
	Context,
	webhookCallback,
} from 'https://deno.land/x/grammy@v1.17.2/mod.ts';
import TelegramService from './src/service/TelegramService.ts';
import { clearChatHistory } from './src/repository/ChatRepository.ts';
import { modelCommands } from './src/config/models.ts';
import {
	adminHelpMessage,
	adminKeyboard,
	userHelpMessage,
	userKeyboard,
} from './src/config/KeyboardConfig.ts';

import './src/prototype/StringExtensionPrototype.ts';
import './src/prototype/ContextExtensionPrototype.ts';

const TOKEN: string = Deno.env.get('BOT_TOKEN') as string;
const PORT: number = parseInt(Deno.env.get('PORT') as string) || 3333;
const ADMIN_USER_IDS: number[] = (Deno.env.get('ADMIN_USER_IDS') as string)
	.split('|').map((id) => parseInt(id));

const BOT = new Bot(TOKEN);
const APP = new Application();

APP.use(oakCors());

/**
 * Register bot commands and handlers
 */
function registerBotCommands() {
	BOT.command(
		'start',
		(ctx) =>
			ctx.reply('Olá, me envie uma mensagem para começarmos a conversar!'),
	);
	BOT.command('help', (ctx) => {
		const userId = ctx.from?.id;
		const isAdmin = ADMIN_USER_IDS.includes(userId!);

		const keyboard = isAdmin ? adminKeyboard : userKeyboard;
		const message = isAdmin ? adminHelpMessage : userHelpMessage;

		ctx.reply(message, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
	});

	BOT.command(
		'currentmodel',
		async (ctx) =>
			ctx.reply(`Modelo atual: ${await TelegramService.getCurrentModel(ctx)}`),
	);
	BOT.command(
		'adminIds',
		async (ctx) =>
			ADMIN_USER_IDS.includes(ctx.from?.id!) && ctx.reply((await TelegramService.getAdminIds(ctx)).join('|')),
	);
	BOT.command('clear', (ctx) => clearChatHistoryHandler(ctx));

	BOT.hears(
		/^(llama|sql|code|cloudflareImage):/gi,
		(ctx) =>
			TelegramService.callAdminModel(ctx, TelegramService.callCloudflareModel),
	);
	BOT.hears(
		/^(perplexity|reasonSearch|search):/gi,
		(ctx) =>
			TelegramService.callAdminModel(ctx, TelegramService.callPerplexityModel),
	);
	BOT.hears(
		/^(gpt|gptImage):/gi,
		(ctx) =>
			TelegramService.callAdminModel(ctx, TelegramService.callOpenAIModel),
	);
	BOT.hears(
		/^(r1off|r1|v3|mixtral|qwen|claude|gemini|geminiPro|image|fala):/gi,
		(ctx) =>
			TelegramService.callAdminModel(ctx, TelegramService.callBlackboxModel),
	);

	BOT.hears(
		new RegExp(`^(${modelCommands.join('|')})$`),
		async (ctx) => await TelegramService.setCurrentModel(ctx),
	);

	BOT.callbackQuery('/clear', async (ctx) => {
		await clearChatHistoryHandler(ctx);
		ctx.answerCallbackQuery();
	});

	BOT.callbackQuery('/currentmodel', async (ctx) => {
		ctx.reply(`Modelo atual: ${await TelegramService.getCurrentModel(ctx)}`);
		ctx.answerCallbackQuery();
	});

	BOT.on('callback_query:data', async (ctx) => {
		await TelegramService.setCurrentModel(ctx);
		ctx.answerCallbackQuery();
	});

	BOT.on(
		'message',
		(ctx) => TelegramService.callModel(ctx, TelegramService.replyTextContent),
	);
}

/**
 * Configure application middleware
 */
function configureMiddleware() {
	APP.use(async (ctx, next) => {
		try {
			if (ctx.request.url.pathname !== '/webhook') {
				ctx.response.status = 200;
				ctx.response.body = 'Use with https://t.me/llm_gemini_bot';
				TelegramService.setWebhook();
				return;
			}
			await next();
		} catch (err) {
			ctx.response.status = 500;
			ctx.response.body = {
				message: err instanceof Error ? err.message : 'Unknown error occurred',
			};
		}
	});
}

/**
 * Clear chat history and notify user
 * @param ctx - Telegram context
 */
async function clearChatHistoryHandler(ctx: Context) {
	const userId = ctx.msg?.from?.id || ctx.from?.id;
	const userKey = `user:${userId}`;
	await clearChatHistory(userKey);
	await ctx.reply('Histórico de conversa apagado com sucesso!');
}

/**
 * Initialize and start the application
 */
function initializeApp() {
	registerBotCommands();
	configureMiddleware();

	if (Deno.env.get('DENO_DEPLOYMENT_ID')) {
		Deno.cron('Configure Telegram bot webhook', '0 0 * * *', async () => {
			await TelegramService.setWebhook();
		});

		APP.use(webhookCallback(BOT, 'oak'));
		APP.listen({ port: PORT });
	} else {
		BOT.start();
	}
}

initializeApp();
