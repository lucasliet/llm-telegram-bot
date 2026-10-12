import process from 'node:process';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bot, Context, type MiddlewareFn } from 'grammy';
import { autoChatAction, AutoChatActionFlavor } from 'grammy-auto-chat-action';
import TelegramService from '@/service/TelegramService.ts';
import { clearChatHistory } from '@/repository/ChatRepository.ts';
import { handleCompress } from '@/handlers/CompressHandler.ts';
import { modelCommands } from '@/config/models.ts';
import { adminHelpMessage, adminKeyboard, userHelpMessage, userKeyboard } from '@/config/KeyboardConfig.ts';

import '@/prototype/StringExtensionPrototype.ts';
import '@/prototype/ContextExtensionPrototype.ts';
import '@/prototype/ReadableStreamDefaultReaderPrototype.ts';

const getToken = () => process.env.BOT_TOKEN as string;
const getAdminUserIds = () =>
	(process.env.ADMIN_USER_IDS as string)
		.split('|').map((id) => parseInt(id));

export type MyContext = Context & AutoChatActionFlavor;

/**
 * Register bot commands and handlers
 * @param bot - Bot instance receiving the handlers
 */
function registerBotCommands(bot: Bot<MyContext>) {
	bot.command(
		'start',
		(ctx) => ctx.reply('Olá, me envie uma mensagem para começarmos a conversar!'),
	);
	bot.command('help', (ctx) => {
		const userId = ctx.from?.id;
		const isAdmin = getAdminUserIds().includes(userId!);

		const keyboard = isAdmin ? adminKeyboard : userKeyboard;
		const message = isAdmin ? adminHelpMessage : userHelpMessage;

		ctx.reply(message, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
	});

	bot.command(
		'currentmodel',
		async (ctx) => ctx.reply(`Modelo atual: ${await TelegramService.getCurrentModel(ctx)}`),
	);
	bot.command(
		'adminIds',
		async (ctx) => getAdminUserIds().includes(ctx.from?.id!) && ctx.reply((await TelegramService.getAdminIds(ctx)).join('|')),
	);
	bot.command('usage', (ctx) => TelegramService.getUsage(ctx));
	bot.command('clear', (ctx) => clearChatHistoryHandler(ctx));
	bot.command('compress', (ctx) => {
		console.log('Compress command received');
		new Promise((resolve) => handleCompress(ctx).then(resolve));
	});

	bot.hears(
		/^(kimi|cloudflareImage):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callCloudflareModel),
	);
	bot.hears(
		/^(fala):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callFala),
	);
	bot.hears(
		/^(perplexity|reasonSearch|search):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callPerplexityModel),
	);
	bot.hears(
		/^(gptImage):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callOpenAIModel),
	);
	bot.hears(
		/^(gpt|gpt5|claude):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callGithubCopilotModel),
	);
	bot.hears(
		/^(gemini):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callVertexModel),
	);
	bot.hears(
		/^(pgpt|pgrok|po3|pclaude):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callOpenWebUIModel),
	);

	bot.hears(
		/^(free):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callOpenRouterModel),
	);

	bot.hears(
		/^(opencode|spark):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callOpencodeModel),
	);

	bot.hears(
		/^(zai|glm|glmflash):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callZaiModel),
	);

	bot.hears(
		new RegExp(`^(${modelCommands.join('|')})$`),
		async (ctx) => await TelegramService.setCurrentModel(ctx),
	);

	bot.callbackQuery('/clear', async (ctx) => {
		await clearChatHistoryHandler(ctx);
		ctx.answerCallbackQuery();
	});

	bot.callbackQuery('/currentmodel', async (ctx) => {
		ctx.reply(`Modelo atual: ${await TelegramService.getCurrentModel(ctx)}`);
		ctx.answerCallbackQuery();
	});

	bot.on('callback_query:data', async (ctx) => {
		await TelegramService.setCurrentModel(ctx);
		ctx.answerCallbackQuery();
	});

	bot.on(
		'message',
		(ctx) => TelegramService.callModel(ctx, TelegramService.replyTextContent),
	);
}

/**
 * Configure application middleware.
 * The catch-all GET awaits setWebhook because Workers cancel pending fetches once the response is sent.
 * @param app - Hono app receiving the middleware and routes
 */
function configureMiddleware(app: Hono) {
	app.use('*', async (c, next) => {
		const start = Date.now();
		await next();
		const ms = Date.now() - start;
		console.log(`${c.req.method} ${c.req.url} - ${ms}ms`);
	});

	app.get('*', async (c) => {
		await TelegramService.setWebhook();
		return c.text('Use with https://t.me/llm_gemini_bot');
	});
}

/**
 * Clear chat history and notify user
 * @param ctx - Telegram context
 */
async function clearChatHistoryHandler(ctx: MyContext) {
	const userId = ctx.msg?.from?.id || ctx.from?.id;
	const userKey = `user:${userId}`;
	await clearChatHistory(userKey);
	await ctx.reply('Histórico de conversa apagado com sucesso!');
}

/**
 * Create the bot, fetch its identity from Telegram and register every handler.
 * Must run inside a request handler on Workers (network I/O is not allowed at module scope).
 * @returns Initialized bot instance
 */
export async function createBot(): Promise<Bot<MyContext>> {
	const bot = new Bot<MyContext>(getToken());
	bot.use(autoChatAction() as unknown as MiddlewareFn<MyContext>);
	await bot.init();

	registerBotCommands(bot);
	return bot;
}

/**
 * Build the HTTP app that receives Telegram webhook updates for the given bot.
 * @param bot - Initialized bot instance
 * @returns Hono app with CORS, logging, webhook and setWebhook routes
 */
export function createWebhookApp(bot: Bot<MyContext>): Hono {
	const app = new Hono();
	app.use('*', cors());
	configureMiddleware(app);

	app.post('/webhook', async (c) => {
		let update;
		try {
			update = await c.req.json();
		} catch (err) {
			console.error('[WEBHOOK] Failed to parse body:', err);
			return c.json({ ok: false, error: 'invalid body' }, 400);
		}

		try {
			await bot.handleUpdate(update);
		} catch (err) {
			console.error('[WEBHOOK] bot.handleUpdate error:', err);
		}
		return c.json({ ok: true });
	});

	return app;
}
