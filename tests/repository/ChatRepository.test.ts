import { assertEquals, assertRejects } from 'asserts';
import { MockKvStore } from '../test_helpers.ts';
import { ApiKeyNotFoundError } from '../../src/error/ApiKeyNotFoundError.ts';
import { compressText } from 'https://deno.land/x/textcompress@v1.0.0/mod.ts';

const mockKv = new MockKvStore();
const originalOpenKv = Deno.openKv;
Deno.openKv = () => Promise.resolve(mockKv as unknown as Deno.Kv);

const userKey = 'user:12345';
const testApiKey = 'test-api-key';
const testModel = '/gpt';

Deno.test('ChatRepository', async (t) => {
	const {
		setUserGeminiApiKeysIfAbsent,
		getUserGeminiApiKeys,
		getChatHistory,
		addContentToChatHistory,
		clearChatHistory,
		setCurrentModel,
		getCurrentModel,
		setVqdHeader,
		getVqdHeader,
	} = await import('../../src/repository/ChatRepository.ts');

	const resetKv = () => {
		for (const key of (mockKv as any).store.keys()) {
			(mockKv as any).store.delete(key);
		}
	};

	await t.step(
		'setUserGeminiApiKeysIfAbsent should store API key',
		async () => {
			resetKv();

			const result = await setUserGeminiApiKeysIfAbsent(
				userKey,
				'key:test-api-key',
			);
			assertEquals(result, true);

			const storedKey = await (mockKv as any).get([userKey, 'api-key']);
			assertEquals(typeof storedKey.value, 'string');

			const noKeyResult = await setUserGeminiApiKeysIfAbsent(
				userKey,
				'hello world',
			);
			assertEquals(noKeyResult, false);
		},
	);

	await t.step('getUserGeminiApiKeys should retrieve API key', async () => {
		resetKv();

		await (mockKv as any).set([userKey, 'api-key'], compressText(testApiKey));

		const key = await getUserGeminiApiKeys(userKey);
		assertEquals(key, testApiKey);

		await (mockKv as any).delete([userKey, 'api-key']);
		await assertRejects(
			() => getUserGeminiApiKeys(userKey),
			ApiKeyNotFoundError,
			'API key not found',
		);
	});

	await t.step(
		'getChatHistory should return empty array for new users',
		async () => {
			resetKv();

			const history = await getChatHistory(userKey);
			assertEquals(history, []);
		},
	);

	await t.step(
		'addContentToChatHistory should add messages to history',
		async () => {
			resetKv();

			let history = await getChatHistory(userKey);
			assertEquals(history, []);

			await addContentToChatHistory(
				history,
				'',
				'Hello',
				'Hi there!',
				userKey,
			);

			history = await getChatHistory(userKey);
			assertEquals(history.length, 2);
			assertEquals(history[0].role, 'user');
			assertEquals(history[0].parts[0].text, 'Hello');
			assertEquals(history[1].role, 'model');
			assertEquals(history[1].parts[0].text, 'Hi there!');

			await addContentToChatHistory(
				history,
				'Previous message',
				'Follow-up',
				'Response to follow-up',
				userKey,
			);

			history = await getChatHistory(userKey);
			assertEquals(history.length, 4);
			assertEquals(history[2].role, 'user');
			assertEquals(history[2].parts.length, 2);
			assertEquals(history[2].parts[0].text, 'Previous message');
			assertEquals(history[2].parts[1].text, 'Follow-up');
			assertEquals(history[3].role, 'model');
			assertEquals(history[3].parts[0].text, 'Response to follow-up');
		},
	);

	await t.step('clearChatHistory should remove all messages', async () => {
		resetKv();

		let history = await getChatHistory(userKey);
		await addContentToChatHistory(
			history,
			'',
			'Hello',
			'Hi there!',
			userKey,
		);

		history = await getChatHistory(userKey);
		assertEquals(history.length, 2);

		await clearChatHistory(userKey);

		history = await getChatHistory(userKey);
		assertEquals(history, []);
	});

	await t.step(
		'setCurrentModel and getCurrentModel should manage model preference',
		async () => {
			resetKv();

			let model = await getCurrentModel(userKey);
			assertEquals(model, '/gemini');

			await setCurrentModel(userKey, testModel);

			model = await getCurrentModel(userKey);
			assertEquals(model, testModel);
		},
	);

	await t.step(
		'setVqdHeader and getVqdHeader should manage VQD header',
		async () => {
			resetKv();

			let header = await getVqdHeader();
			assertEquals(header, null);

			const testHeader = 'test-vqd-header';
			await setVqdHeader(testHeader);

			header = await getVqdHeader();
			assertEquals(header, testHeader);
		},
	);

	await mockKv.close();
	Deno.openKv = originalOpenKv;
});
