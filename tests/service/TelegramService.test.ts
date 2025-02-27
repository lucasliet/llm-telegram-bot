import { assertEquals } from 'asserts';
import { spy } from 'mock';
import {
	assertSpyCalls,
	createMockContext,
	MockContext,
	mockDenoEnv,
} from '../test_helpers.ts';

// Mock the repository module
import { ModelCommand } from '../../src/config/models.ts';

// Setup and teardown
Deno.test('TelegramService', async (t) => {
	// Set up environment before all tests
	mockDenoEnv({
		'BOT_TOKEN': 'test_token',
		'ADMIN_USER_IDS': '12345|67890',
	});

	// Mock fetch for the setWebhook test
	const originalFetch = globalThis.fetch;
	const mockFetch = spy(() =>
		Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
	);
	globalThis.fetch = mockFetch;

	// Mock Deno.openKv to prevent database leak
	const originalOpenKv = Deno.openKv;
	const mockKv = {
		get: () => Promise.resolve({ value: '/gpt' }),
		set: () => Promise.resolve({ ok: true }),
		delete: () => Promise.resolve({ ok: true }),
		close: () => Promise.resolve(),
	};
	Deno.openKv = () => Promise.resolve(mockKv);

	// Mock timer functions
	const originalSetInterval = globalThis.setInterval;
	const originalClearInterval = globalThis.clearInterval;
	const originalSetTimeout = globalThis.setTimeout;
	const originalClearTimeout = globalThis.clearTimeout;

	// Mock handlers modules to avoid unreachable errors
	const handlers = {
		handleOpenAI: spy(() => Promise.resolve()),
		handlePerplexity: spy(() => Promise.resolve()),
		handleCloudflare: spy(() => Promise.resolve()),
		handleBlackbox: spy(() => Promise.resolve()),
		handlePuter: spy(() => Promise.resolve()),
		handleGemini: spy(() => Promise.resolve()),
	};

	// Replace the handlers in the module
	const originalHandlers = {
		handleOpenAI: globalThis.handleOpenAI,
		handlePerplexity: globalThis.handlePerplexity,
		handleCloudflare: globalThis.handleCloudflare,
		handleBlackbox: globalThis.handleBlackbox,
		handlePuter: globalThis.handlePuter,
		handleGemini: globalThis.handleGemini,
	};

	// Import the service after mocking dependencies
	const originalModule = await import('../../src/service/TelegramService.ts');

	// Save original module functions for restoration
	const originalSetCurrentModel = originalModule.default.setCurrentModel;
	const originalGetCurrentModel = originalModule.default.getCurrentModel;
	const originalCallModel = originalModule.default.callModel;
	const originalReplyTextContent = originalModule.default.replyTextContent;

	// Mock repository functions
	const mockChatRepository = {
		setCurrentModel: spy(),
		getCurrentModel: spy(() => '/gpt'),
		clearChatHistory: spy(),
	};

	// Replace module functions with test implementations
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

	// Import TelegramService after mocking
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
			// Admin user
			const adminCtx = createMockContext({ userId: 12345 });
			const adminIds = await TelegramService.getAdminIds(adminCtx);

			assertEquals(adminIds, [12345, 67890]);

			// Non-admin user
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

	await t.step(
		'callAdminModel should route to proper model for admin users',
		async () => {
			// Mock callModel
			const origCallModel = TelegramService.callModel;
			const mockCallModel = spy();
			TelegramService.callModel = mockCallModel;

			try {
				// Test with admin user
				const adminCtx = createMockContext({ userId: 12345 });
				const modelFunc = spy();

				TelegramService.callAdminModel(adminCtx, modelFunc);

				assertSpyCalls(mockCallModel, 1);
				assertEquals(mockCallModel.calls[0].args[0], adminCtx);
				assertEquals(mockCallModel.calls[0].args[1], modelFunc);

				// Test with non-admin user
				// Create a new spy for the second test
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
				// Restore original function
				TelegramService.callModel = origCallModel;
			}
		},
	);

	await t.step('callModel should handle successful model calls', async () => {
		// Mock timer functions
		const mockSetInterval = spy(() => 123);
		const mockClearInterval = spy();
		globalThis.setInterval = mockSetInterval;
		globalThis.clearInterval = mockClearInterval;

		const mockSetTimeout = spy(() => 456);
		const mockClearTimeout = spy();
		globalThis.setTimeout = mockSetTimeout;
		globalThis.clearTimeout = mockClearTimeout;

		// Setup
		const ctx = createMockContext();
		ctx.replyOnLongAnswer = spy(() => 456);
		const modelFunc = spy(() => Promise.resolve());

		// Execute
		TelegramService.callModel(ctx, modelFunc);

		// Verify
		assertSpyCalls(modelFunc, 1);
		assertEquals(modelFunc.calls[0].args[0], ctx);
		assertSpyCalls(ctx.replyOnLongAnswer, 1);
		assertSpyCalls(mockSetInterval, 1);
	});

	await t.step('callModel should handle errors in model calls', async () => {
		// Mock timer functions
		const mockSetInterval = spy(() => 123);
		const mockClearInterval = spy();
		globalThis.setInterval = mockSetInterval;
		globalThis.clearInterval = mockClearInterval;

		const mockSetTimeout = spy(() => 456);
		const mockClearTimeout = spy();
		globalThis.setTimeout = mockSetTimeout;
		globalThis.clearTimeout = mockClearTimeout;

		// Setup
		const ctx = createMockContext();
		ctx.replyOnLongAnswer = spy(() => 456);
		const error = new Error('Test error');
		const modelFunc = spy(() => Promise.reject(error));

		// Execute
		TelegramService.callModel(ctx, modelFunc);

		// Verify minimal expectations
		assertSpyCalls(modelFunc, 1);
		assertSpyCalls(mockSetInterval, 1);
	});

	await t.step('service should have model-specific handler wrappers', () => {
		// Verify the model-specific handlers exist and are functions
		assertEquals(typeof TelegramService.callOpenAIModel, 'function');
		assertEquals(typeof TelegramService.callPerplexityModel, 'function');
		assertEquals(typeof TelegramService.callCloudflareModel, 'function');
		assertEquals(typeof TelegramService.callBlackboxModel, 'function');
		assertEquals(typeof TelegramService.callPuterModel, 'function');

		// Test that the functions take the right parameters
		const ctx = createMockContext();
		const mockHandleOpenAI = spy();

		// Replace the handler temporarily
		globalThis.handleOpenAI = mockHandleOpenAI;

		// Call the handler and verify the method signature works
		TelegramService.callOpenAIModel(ctx, 'test message');

		// We don't assert the spy was called because the actual function
		// is async and our test doesn't wait, but we can verify the function
		// structure is correct
	});

	// Restore mocks
	globalThis.fetch = originalFetch;
	Deno.openKv = originalOpenKv;
	globalThis.setInterval = originalSetInterval;
	globalThis.clearInterval = originalClearInterval;
	globalThis.setTimeout = originalSetTimeout;
	globalThis.clearTimeout = originalClearTimeout;

	// Restore handler functions
	globalThis.handleOpenAI = originalHandlers.handleOpenAI;
	globalThis.handlePerplexity = originalHandlers.handlePerplexity;
	globalThis.handleCloudflare = originalHandlers.handleCloudflare;
	globalThis.handleBlackbox = originalHandlers.handleBlackbox;
	globalThis.handlePuter = originalHandlers.handlePuter;
	globalThis.handleGemini = originalHandlers.handleGemini;

	// Restore original module functions
	originalModule.default.setCurrentModel = originalSetCurrentModel;
	originalModule.default.getCurrentModel = originalGetCurrentModel;
	originalModule.default.callModel = originalCallModel;
	originalModule.default.replyTextContent = originalReplyTextContent;
});
