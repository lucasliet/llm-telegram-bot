import { Application } from 'oak';
import { oakCors } from 'oak-cors';
import { Bot, Context, webhookCallback } from 'grammy';
import TelegramService from '@/service/TelegramService.ts';
import { clearChatHistory } from '@/repository/ChatRepository.ts';
import { modelCommands } from '@/config/models.ts';
import { adminHelpMessage, adminKeyboard, userHelpMessage, userKeyboard } from '@/config/KeyboardConfig.ts';

import '@/prototype/StringExtensionPrototype.ts';
import '@/prototype/ContextExtensionPrototype.ts';
import '@/prototype/ReadableStreamDefaultReaderPrototype.ts';

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
		(ctx) => ctx.reply('Olá, me envie uma mensagem para começarmos a conversar!'),
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
		async (ctx) => ctx.reply(`Modelo atual: ${await TelegramService.getCurrentModel(ctx)}`),
	);
	BOT.command(
		'adminIds',
		async (ctx) => ADMIN_USER_IDS.includes(ctx.from?.id!) && ctx.reply((await TelegramService.getAdminIds(ctx)).join('|')),
	);
	BOT.command('usage', (ctx) => TelegramService.getUsage(ctx));
	BOT.command('clear', (ctx) => clearChatHistoryHandler(ctx));

	BOT.hears(
		/^(oss|cloudflareImage|image):/gi,
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
		/^(gpt|gpt5|claude|geminiPro):/gi,
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
		const start = Date.now();
		await next();
		const ms = Date.now() - start;
		console.log(`${ctx.request.method} ${ctx.request.url} - ${ms}ms`);
	});

	APP.use(async (ctx, next) => {
		if (ctx.request.url.pathname === '/robots.txt') {
			try {
				const robotsTxt = await Deno.readTextFile('./static/robots.txt');
				ctx.response.headers.set('Content-Type', 'text/plain');
				ctx.response.body = robotsTxt;
			} catch {
				ctx.response.status = 200;
				ctx.response.headers.set('Content-Type', 'text/plain');
				ctx.response.body = 'User-agent: *\nDisallow: /';
			}
			return;
		}
		await next();
	});

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
