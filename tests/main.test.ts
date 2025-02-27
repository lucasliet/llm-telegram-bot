import { assertEquals } from 'asserts';
import { mockDenoEnv } from './test_helpers.ts';

// Test that verifies that key components can be loaded successfully
Deno.test('Key components load correctly', async () => {
	// Set up mock environment variables
	mockDenoEnv({
		'BOT_TOKEN': 'test_token',
		'ADMIN_USER_IDS': '12345|67890',
		'PORT': '3333',
	});

	// Mock Deno.openKv to prevent database leak
	const originalOpenKv = Deno.openKv;
	const mockKv = {
		get: () => Promise.resolve({ value: '/gpt' }),
		set: () => Promise.resolve({ ok: true }),
		delete: () => Promise.resolve({ ok: true }),
		close: () => Promise.resolve(),
	};
	Deno.openKv = () => Promise.resolve(mockKv);

	try {
		// Import key components instead of main to avoid initializing the whole application
		console.log('Testing key component loading...');

		// Import key services
		const telegramService = await import('../src/service/TelegramService.ts');
		assertEquals(
			typeof telegramService.default,
			'object',
			'TelegramService should be loadable',
		);

		// Import repository
		const chatRepository = await import('../src/repository/ChatRepository.ts');
		assertEquals(
			typeof chatRepository.clearChatHistory,
			'function',
			'ChatRepository should be loadable',
		);

		// Import config
		const models = await import('../src/config/models.ts');
		assertEquals(
			Array.isArray(models.modelCommands),
			true,
			'models config should be loadable',
		);

		console.log('All key components load correctly');
	} catch (err) {
		console.error('Error loading key components:', err);
		throw err;
	} finally {
		// Clean up mock
		Deno.openKv = originalOpenKv;
	}
});
