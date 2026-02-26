import { assertEquals } from 'asserts';
import { MockKvStore } from '../test_helpers.ts';
import { compressObject } from 'textcompress';

const mockKv = new MockKvStore();
const originalOpenKv = Deno.openKv;
Deno.openKv = () => Promise.resolve(mockKv as unknown as Deno.Kv);

const userKey = 'user:12345';
const testModel = '/polli';

Deno.test('ChatRepository', async (t) => {
	const {
		getChatHistory,
		addContentToChatHistory,
		clearChatHistory,
		setCurrentModel,
		getCurrentModel,
	} = await import('../../src/repository/ChatRepository.ts');

	/** Resets the mock KV store */
	const resetKv = () => {
		for (const key of (mockKv as any).store.keys()) {
			(mockKv as any).store.delete(key);
		}
	};

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

			await addContentToChatHistory(history, 'Hello', 'Hi there!', userKey);

			history = await getChatHistory(userKey);
			assertEquals(history.length, 2);
			assertEquals(history[0].role, 'user');
			assertEquals((history[0] as any).content, 'Hello');
			assertEquals(history[1].role, 'assistant');
			assertEquals((history[1] as any).content, 'Hi there!');

			await addContentToChatHistory(
				history,
				'quote: "Previous message"\n\nFollow-up',
				'Response to follow-up',
				userKey,
			);

			history = await getChatHistory(userKey);
			assertEquals(history.length, 4);
			assertEquals(history[2].role, 'user');
			assertEquals((history[2] as any).content, 'quote: "Previous message"\n\nFollow-up');
			assertEquals(history[3].role, 'assistant');
			assertEquals((history[3] as any).content, 'Response to follow-up');
		},
	);

	await t.step('clearChatHistory should remove all messages', async () => {
		resetKv();

		let history = await getChatHistory(userKey);
		await addContentToChatHistory(history, 'Hello', 'Hi there!', userKey);

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
			assertEquals(model, '/polli');

			await setCurrentModel(userKey, testModel);

			model = await getCurrentModel(userKey);
			assertEquals(model, testModel);
		},
	);

	await mockKv.close();
	Deno.openKv = originalOpenKv;
});
