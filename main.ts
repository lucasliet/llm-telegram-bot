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
import { AntigravityAuth } from '@/scripts/AntigravityAuth.ts';
import { CopilotAuth } from '@/scripts/CopilotAuth.ts';

const getToken = () => Deno.env.get('BOT_TOKEN') as string;
const getPort = () => parseInt(Deno.env.get('PORT') as string) || 3333;
const getAdminUserIds = () => (Deno.env.get('ADMIN_USER_IDS') as string)
	.split('|').map((id) => parseInt(id));

type MyContext = Context & AutoChatActionFlavor;

let BOT: Bot<MyContext>;
const APP = new Hono();

APP.use('*', cors());

/**
 * Register bot commands and handlers
 */
function registerBotCommands() {
	BOT.command(
		'start',
		(ctx) => ctx.reply('Olá, me envie uma mensagem para começarmos a conversar!'),
	);
	BOT.command('help', (ctx) => {
		const userId = ctx.from?.id;
		const isAdmin = getAdminUserIds().includes(userId!);

		const keyboard = isAdmin ? adminKeyboard : userKeyboard;
		const message = isAdmin ? adminHelpMessage : userHelpMessage;

		ctx.reply(message, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
	});

	BOT.command(
		'currentmodel',
		async (ctx) => ctx.reply(`Modelo atual: ${await TelegramService.getCurrentModel(ctx)}`),
	);
	BOT.command(
		'adminIds',
		async (ctx) => getAdminUserIds().includes(ctx.from?.id!) && ctx.reply((await TelegramService.getAdminIds(ctx)).join('|')),
	);
	BOT.command('usage', (ctx) => TelegramService.getUsage(ctx));
	BOT.command('clear', (ctx) => clearChatHistoryHandler(ctx));
	BOT.command('compress', (ctx) => {
	  console.log('Compress command received');
	  new Promise((resolve) => handleCompress(ctx).then(resolve))
	});

	BOT.hears(
		/^(oss|llama):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callGroqModel),
	);
	BOT.hears(
		/^(cloudflareImage|image):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callCloudflareModel),
	);
	BOT.hears(
		/^(fala):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callFala),
	);
	BOT.hears(
		/^(perplexity|reasonSearch|search):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callPerplexityModel),
	);
	BOT.hears(
		/^(gptImage):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callOpenAIModel),
	);
	BOT.hears(
		/^(gpt|gpt5|claude):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callGithubCopilotModel),
	);
	BOT.hears(
		/^(geminiPro|gemini):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callVertexModel),
	);
	BOT.hears(
		/^(pgpt|pgrok|po3|pclaude):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callOpenWebUIModel),
	);

	BOT.hears(
		/^(polli|polliReasoning|polliImage):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callPollinationsModel),
	);
	BOT.hears(
		/^(artaImage):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callArtaModel),
	);
	BOT.hears(
		/^(antigravity|antigemini|antigeminipro):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callAntigravityModel),
	);

	BOT.hears(
		/^(zai|glm|glmflash):/gi,
		(ctx) => TelegramService.callAdminModel(ctx, TelegramService.callZaiModel),
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
	APP.use('*', async (c, next) => {
		const start = Date.now();
		await next();
		const ms = Date.now() - start;
		console.log(`${c.req.method} ${c.req.url} - ${ms}ms`);
	});

	APP.get('/robots.txt', async (c) => {
		try {
			const robotsTxt = await Deno.readTextFile('./static/robots.txt');
			return c.text(robotsTxt, 200, { 'Content-Type': 'text/plain' });
		} catch {
			return c.text('User-agent: *\nDisallow: /', 200, { 'Content-Type': 'text/plain' });
		}
	});

	APP.get('*', (c) => {
		TelegramService.setWebhook();
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
 * Initialize and start the application
 */
async function initializeApp() {
	if (Deno.args.includes('antigravity-login')) {
		await new AntigravityAuth().run();
		return;
	}

	if (Deno.args.includes('copilot-login')) {
		await new CopilotAuth().run();
		return;
	}

	BOT = new Bot<MyContext>(getToken());
	BOT.use(autoChatAction() as unknown as MiddlewareFn<MyContext>);
	await BOT.init();

	registerBotCommands();
	configureMiddleware();

	if (Deno.env.get('DENO_DEPLOYMENT_ID')) {
		Deno.cron('Configure Telegram bot webhook', '0 0 * * *', async () => {
			await TelegramService.setWebhook();
		});

		APP.post('/webhook', async (c) => {
			let update;
			try {
				update = await c.req.json();
			} catch (err) {
				console.error('[WEBHOOK] Failed to parse body:', err);
				return c.json({ ok: false, error: 'invalid body' }, 400);
			}

			try {
				await BOT.handleUpdate(update);
			} catch (err) {
				console.error('[WEBHOOK] BOT.handleUpdate error:', err);
			}
			return c.json({ ok: true });
		});

		Deno.serve(APP.fetch);
	} else {
		BOT.start();
	}
}

await initializeApp();
