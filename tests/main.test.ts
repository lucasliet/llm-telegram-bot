import { assertEquals } from 'asserts';
import { mockDenoEnv } from './test_helpers.ts';

Deno.test('Key components load correctly', async () => {
	mockDenoEnv({
		'BOT_TOKEN': 'test_token',
		'ADMIN_USER_IDS': '12345|67890',
		'PORT': '3333',
	});

	const originalOpenKv = Deno.openKv;
	const mockKv = {
		get: () => Promise.resolve({ value: '/gpt' }),
		set: () => Promise.resolve({ ok: true }),
		delete: () => Promise.resolve({ ok: true }),
		close: () => Promise.resolve(),
	};
	Deno.openKv = () => Promise.resolve(mockKv);

	try {
		console.log('Testing key component loading...');

		const telegramService = await import('../src/service/TelegramService.ts');
		assertEquals(
			typeof telegramService.default,
			'object',
			'TelegramService should be loadable',
		);

		const chatRepository = await import('../src/repository/ChatRepository.ts');
		assertEquals(
			typeof chatRepository.clearChatHistory,
			'function',
			'ChatRepository should be loadable',
		);

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
		Deno.openKv = originalOpenKv;
	}
});
