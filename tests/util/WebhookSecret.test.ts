import { assertEquals, assertMatch } from 'asserts';
import { deriveWebhookSecret, isValidWebhookSecret } from '@/util/WebhookSecret.ts';

Deno.test('WebhookSecret', async (t) => {
	await t.step('deriva um segredo determinístico só com caracteres aceitos pelo Telegram', async () => {
		// Given
		const botToken = '123:abc-DEF';

		// When
		const secret = await deriveWebhookSecret(botToken);

		// Then
		assertEquals(secret, '6e8545153a5a1870c551491068c28b681b65970e39ca26ed6c9bcb819e3338f4');
		assertMatch(secret, /^[A-Za-z0-9_-]{1,256}$/);
	});

	await t.step('aceita apenas o segredo idêntico', async () => {
		// Given
		const expected = await deriveWebhookSecret('123:abc-DEF');
		const otherBotSecret = await deriveWebhookSecret('999:other-bot');

		// When / Then
		assertEquals(isValidWebhookSecret(expected, expected), true);
		assertEquals(isValidWebhookSecret(otherBotSecret, expected), false);
		assertEquals(isValidWebhookSecret(expected.slice(1), expected), false);
		assertEquals(isValidWebhookSecret(null, expected), false);
		assertEquals(isValidWebhookSecret('', expected), false);
	});
});
