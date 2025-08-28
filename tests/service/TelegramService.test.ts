import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { assertSpyCalls, createMockContext, MockContext, mockDenoEnv } from '../test_helpers.ts';

import type { ModelCommand } from '../../src/config/models.ts';
import { modelCommands, WHITELISTED_MODELS } from '../../src/config/models.ts';

Deno.test('TelegramService', async (t) => {
	mockDenoEnv({
		'BOT_TOKEN': 'test_token',
		'ADMIN_USER_IDS': '12345|67890',
	});

	const originalFetch = globalThis.fetch;
	const mockFetch = spy(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
	globalThis.fetch = mockFetch;

	const originalOpenKv = Deno.openKv;
	const mockKv = {
		get: () => Promise.resolve({ value: '/gpt' }),
		set: spy(() => Promise.resolve({ ok: true })),
		delete: () => Promise.resolve({ ok: true }),
		close: () => Promise.resolve(),
	};
	Deno.openKv = () => Promise.resolve(mockKv);

	const originalSetInterval = globalThis.setInterval;
	const originalClearInterval = globalThis.clearInterval;
	const originalSetTimeout = globalThis.setTimeout;
	const originalClearTimeout = globalThis.clearTimeout;

	const handlers = {
		handleOpenAI: spy(() => Promise.resolve()),
		handlePerplexity: spy(() => Promise.resolve()),
		handleCloudflare: spy(() => Promise.resolve()),
		handleBlackbox: spy(() => Promise.resolve()),
		handlePuter: spy(() => Promise.resolve()),
		handleGemini: spy(() => Promise.resolve()),
	};

	const originalHandlers = {
		handleOpenAI: globalThis.handleOpenAI,
		handlePerplexity: globalThis.handlePerplexity,
		handleCloudflare: globalThis.handleCloudflare,
		handleBlackbox: globalThis.handleBlackbox,
		handlePuter: globalThis.handlePuter,
		handleGemini: globalThis.handleGemini,
	};

	const originalModule = await import('../../src/service/TelegramService.ts');

	const originalSetCurrentModel = originalModule.default.setCurrentModel;
	const originalGetCurrentModel = originalModule.default.getCurrentModel;
	const originalCallModel = originalModule.default.callModel;
	const originalReplyTextContent = originalModule.default.replyTextContent;

	const mockChatRepository = {
		setCurrentModel: spy(),
		getCurrentModel: spy(() => '/gpt'),
		clearChatHistory: spy(),
	};

	originalModule.default.setCurrentModel = async (ctx: MockContext) => {
		const { userKey, contextMessage: message } = await ctx.extractContextKeys();
		const command = (message || ctx.callbackQuery?.data) as ModelCommand;
		await mockChatRepository.setCurrentModel(userKey, command);
		ctx.reply(`Novo modelo de inteligência escolhido: ${command}`);
	};

	originalModule.default.getCurrentModel = async (ctx: MockContext) => {
		const { userKey } = await ctx.extractContextKeys();
		return await mockChatRepository.getCurrentModel(userKey) as ModelCommand;
	};

	const TelegramService = originalModule.default;

	await t.step('setWebhook should call Telegram API', async () => {
		await TelegramService.setWebhook();

		assertSpyCalls(mockFetch, 1);
		const [url, options] = mockFetch.calls[0].args;

		assertEquals(url, 'https://api.telegram.org/bottest_token/setWebhook');
		assertEquals(options.method, 'POST');
		assertEquals(options.headers['Content-Type'], 'application/json');
		assertEquals(
			JSON.parse(options.body),
			{ url: 'https://llm-telegram-bot.deno.dev/webhook' },
		);
	});

	await t.step(
		'getAdminIds should return admin IDs for admin users',
		async () => {
			const adminCtx = createMockContext({ userId: 12345 });
			const adminIds = await TelegramService.getAdminIds(adminCtx);

			assertEquals(adminIds, [12345, 67890]);

			const userCtx = createMockContext({ userId: 99999 });
			const emptyIds = await TelegramService.getAdminIds(userCtx);

			assertEquals(emptyIds, []);
		},
	);

	await t.step('getCurrentModel should get model from repository', async () => {
		const ctx = createMockContext();

		const model = await TelegramService.getCurrentModel(ctx);

		assertEquals(model, '/gpt');
		assertSpyCalls(mockChatRepository.getCurrentModel, 1);
	});

	await t.step('setCurrentModel should update current model', async () => {
		const ctx = createMockContext({
			message: '/gpt',
		});

		await TelegramService.setCurrentModel(ctx);

		assertSpyCalls(mockChatRepository.setCurrentModel, 1);
		assertSpyCalls(ctx.reply, 1);
		assertEquals(
			ctx.reply.calls[0].args[0],
			'Novo modelo de inteligência escolhido: /gpt',
		);
	});

	await t.step('setCurrentModel should enforce whitelist for non-admin users', async () => {
		const nonAdmin = 99999;
		assertEquals(
			WHITELISTED_MODELS.every((m) => modelCommands.includes(m)),
			true,
			'WHITELISTED_MODELS deve ser subconjunto de modelCommands',
		);
		assertEquals(
			new Set(WHITELISTED_MODELS).size,
			WHITELISTED_MODELS.length,
			'WHITELISTED_MODELS não deve conter duplicatas',
		);
		for (const model of WHITELISTED_MODELS) {
			mockKv.set = spy(() => Promise.resolve({ ok: true }));
			const ctx = createMockContext({ userId: nonAdmin, message: model });
			await originalSetCurrentModel(ctx as any);
			assertSpyCalls(mockKv.set, 1);
			assertSpyCalls(ctx.reply, 1);
			const expectedKey = [`user:${nonAdmin}`, 'current_model'];
			assertEquals(mockKv.set.calls[0].args[0], expectedKey);
			assertEquals(mockKv.set.calls[0].args[1], model);
			assertEquals(
				ctx.reply.calls[0].args[0],
				`Novo modelo de inteligência escolhido: ${model}`,
			);
		}
		const disallowed = modelCommands.filter((m) => !WHITELISTED_MODELS.includes(m));
		for (const model of disallowed) {
			mockKv.set = spy(() => Promise.resolve({ ok: true }));
			const ctx = createMockContext({ userId: nonAdmin, message: model });
			await originalSetCurrentModel(ctx as any);
			assertSpyCalls(mockKv.set, 0);
			assertSpyCalls(ctx.reply, 0);
		}
	});

	await t.step(
		'callAdminModel should route to proper model for admin users',
		async () => {
			const origCallModel = TelegramService.callModel;
			const mockCallModel = spy();
			TelegramService.callModel = mockCallModel;

			try {
				const adminCtx = createMockContext({ userId: 12345 });
				const modelFunc = spy();

				TelegramService.callAdminModel(adminCtx, modelFunc);

				assertSpyCalls(mockCallModel, 1);
				assertEquals(mockCallModel.calls[0].args[0], adminCtx);
				assertEquals(mockCallModel.calls[0].args[1], modelFunc);

				const mockCallModel2 = spy();
				TelegramService.callModel = mockCallModel2;
				const userCtx = createMockContext({ userId: 99999 });

				TelegramService.callAdminModel(userCtx, modelFunc);

				assertSpyCalls(mockCallModel2, 1);
				assertEquals(mockCallModel2.calls[0].args[0], userCtx);
				assertEquals(
					mockCallModel2.calls[0].args[1],
					TelegramService.replyTextContent,
				);
			} finally {
				TelegramService.callModel = origCallModel;
			}
		},
	);

	await t.step('callModel should handle successful model calls', async () => {
		const mockSetInterval = spy(() => 123);
		const mockClearInterval = spy();
		globalThis.setInterval = mockSetInterval;
		globalThis.clearInterval = mockClearInterval;

		const mockSetTimeout = spy(() => 456);
		const mockClearTimeout = spy();
		globalThis.setTimeout = mockSetTimeout;
		globalThis.clearTimeout = mockClearTimeout;

		const ctx = createMockContext();
		ctx.replyOnLongAnswer = spy(() => 456);
		const modelFunc = spy(() => Promise.resolve());

		TelegramService.callModel(ctx, modelFunc);

		assertSpyCalls(modelFunc, 1);
		assertEquals(modelFunc.calls[0].args[0], ctx);
		assertSpyCalls(ctx.replyOnLongAnswer, 1);
		assertSpyCalls(mockSetInterval, 1);
	});

	await t.step('callModel should handle errors in model calls', async () => {
		const mockSetInterval = spy(() => 123);
		const mockClearInterval = spy();
		globalThis.setInterval = mockSetInterval;
		globalThis.clearInterval = mockClearInterval;

		const mockSetTimeout = spy(() => 456);
		const mockClearTimeout = spy();
		globalThis.setTimeout = mockSetTimeout;
		globalThis.clearTimeout = mockClearTimeout;

		const ctx = createMockContext();
		ctx.replyOnLongAnswer = spy(() => 456);
		const error = new Error('Test error');
		const modelFunc = spy(() => Promise.reject(error));

		TelegramService.callModel(ctx, modelFunc);

		assertSpyCalls(modelFunc, 1);
		assertSpyCalls(mockSetInterval, 1);
	});

	await t.step('service should have model-specific handler wrappers', () => {
		assertEquals(typeof TelegramService.callOpenAIModel, 'function');
		assertEquals(typeof TelegramService.callPerplexityModel, 'function');
		assertEquals(typeof TelegramService.callCloudflareModel, 'function');
		assertEquals(typeof TelegramService.callBlackboxModel, 'function');
		assertEquals(typeof TelegramService.callPuterModel, 'function');

		const ctx = createMockContext();
		const mockHandleOpenAI = spy();

		globalThis.handleOpenAI = mockHandleOpenAI;

		TelegramService.callOpenAIModel(ctx, 'test message');
	});

	globalThis.fetch = originalFetch;
	Deno.openKv = originalOpenKv;
	globalThis.setInterval = originalSetInterval;
	globalThis.clearInterval = originalClearInterval;
	globalThis.setTimeout = originalSetTimeout;
	globalThis.clearTimeout = originalClearTimeout;

	globalThis.handleOpenAI = originalHandlers.handleOpenAI;
	globalThis.handlePerplexity = originalHandlers.handlePerplexity;
	globalThis.handleCloudflare = originalHandlers.handleCloudflare;
	globalThis.handleBlackbox = originalHandlers.handleBlackbox;
	globalThis.handlePuter = originalHandlers.handlePuter;
	globalThis.handleGemini = originalHandlers.handleGemini;

	originalModule.default.setCurrentModel = originalSetCurrentModel;
	originalModule.default.getCurrentModel = originalGetCurrentModel;
	originalModule.default.callModel = originalCallModel;
	originalModule.default.replyTextContent = originalReplyTextContent;
});
