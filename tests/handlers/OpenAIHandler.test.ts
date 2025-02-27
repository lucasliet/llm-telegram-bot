import { assertEquals } from 'asserts';
import { mockDenoEnv } from '../test_helpers.ts';

Deno.test('OpenAIHandler - Structure Test', async () => {
	mockDenoEnv({
		'BOT_TOKEN': 'test_token',
		'ADMIN_USER_IDS': '12345|67890',
		'OPENAI_API_KEY': 'fake-key',
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
		const mod = await import('../../src/handlers/models/OpenAIHandler.ts');

		assertEquals(
			typeof mod.handleOpenAI,
			'function',
			'handleOpenAI should be a function',
		);

		console.log('OpenAIHandler module is properly structured');
	} catch (err) {
		console.error('Error loading OpenAIHandler:', err);
		throw err;
	} finally {
		Deno.openKv = originalOpenKv;
	}
});
