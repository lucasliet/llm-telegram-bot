import { assertEquals, assertRejects } from 'asserts';
import type { Update } from 'grammy-types';
import worker, { UpdateQueueBatch, UpdateQueueBinding, UpdateQueueMessage, WorkerExecutionContext } from '../worker.ts';
import { mockDenoEnv } from './test_helpers.ts';
import { InMemoryKeyValueStore, KVNamespaceBinding, setKeyValueStore } from '@/repository/KeyValueStore.ts';
import { deriveWebhookSecret, WEBHOOK_SECRET_HEADER } from '@/util/WebhookSecret.ts';

class FakeKVNamespace implements KVNamespaceBinding {
	get(_key: string, _type: 'json'): Promise<unknown> {
		return Promise.resolve(null);
	}

	put(_key: string, _value: string): Promise<void> {
		return Promise.resolve();
	}

	delete(_key: string): Promise<void> {
		return Promise.resolve();
	}
}

class FakeUpdateQueue implements UpdateQueueBinding {
	readonly sent: Update[] = [];
	failing = false;

	send(body: Update): Promise<void> {
		if (this.failing) return Promise.reject(new Error('queue unavailable'));
		this.sent.push(body);
		return Promise.resolve();
	}
}

class FakeQueueMessage implements UpdateQueueMessage {
	readonly attempts = 1;
	acked = false;

	constructor(readonly body: Update) {}

	ack(): void {
		this.acked = true;
	}
}

const fakeExecutionContext: WorkerExecutionContext = {
	waitUntil: () => {},
	passThroughOnException: () => {},
};

const getMeResult = {
	ok: true,
	result: {
		id: 1,
		is_bot: true,
		first_name: 'bot',
		username: 'test_bot',
		can_join_groups: true,
		can_read_all_group_messages: false,
		supports_inline_queries: false,
	},
};

/**
 * Fake Telegram API: getMe is rejected with 401 while `tokenRejected` is true; setWebhook always succeeds.
 * A 401 is used because grammy retries 5xx/network errors on init instead of failing.
 */
function createTelegramFetch(state: { tokenRejected: boolean; calls: string[] }): typeof fetch {
	return ((input: string | URL | Request) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
		const method = url.split('/').pop() ?? '';
		state.calls.push(method);
		if (method === 'getMe' && state.tokenRejected) {
			return Promise.resolve(new Response(JSON.stringify({ ok: false, error_code: 401, description: 'Unauthorized' }), { status: 401 }));
		}
		const body = method === 'getMe' ? getMeResult : { ok: true, result: true };
		return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
	}) as typeof fetch;
}

const textUpdate = {
	update_id: 42,
	message: { message_id: 1, date: 0, chat: { id: 1, type: 'private', first_name: 'user' }, from: { id: 1, is_bot: false, first_name: 'user' }, text: 'oi' },
} as Update;

/**
 * Build a POST request carrying a Telegram update to the webhook route.
 * @param update - Update sent as the JSON body
 * @param secret - Value of the Telegram secret header, omitted when undefined
 * @returns Webhook request
 */
function webhookRequest(update: Update, secret?: string): Request {
	const headers = secret === undefined ? undefined : { [WEBHOOK_SECRET_HEADER]: secret };
	return new Request('https://bot.example/webhook', { method: 'POST', body: JSON.stringify(update), headers });
}

Deno.test('worker.ts', { sanitizeResources: false, sanitizeOps: false }, async (t) => {
	mockDenoEnv({ BOT_TOKEN: '123:test', ADMIN_USER_IDS: '1' });
	const originalFetch = globalThis.fetch;
	const state = { tokenRejected: true, calls: [] as string[] };
	globalThis.fetch = createTelegramFetch(state);
	const queue = new FakeUpdateQueue();
	const env = { KV: new FakeKVNamespace(), UPDATES_QUEUE: queue };
	const webhookSecret = await deriveWebhookSecret('123:test');

	try {
		await t.step('webhook enfileira o update e responde sem chamar o Telegram', async () => {
			// Given
			state.calls.length = 0;

			// When
			const response = await worker.fetch(webhookRequest(textUpdate, webhookSecret), env, fakeExecutionContext);

			// Then
			assertEquals(response.status, 200);
			assertEquals(queue.sent, [textUpdate]);
			assertEquals(state.calls, []);
		});

		await t.step('webhook rejeita update forjado sem o segredo derivado do bot token', async () => {
			// Given
			queue.sent.length = 0;
			const otherBotSecret = await deriveWebhookSecret('999:other-bot');

			// When
			const withoutHeader = await worker.fetch(webhookRequest(textUpdate), env, fakeExecutionContext);
			const withOtherBotSecret = await worker.fetch(webhookRequest(textUpdate, otherBotSecret), env, fakeExecutionContext);

			// Then
			assertEquals(withoutHeader.status, 401);
			assertEquals(withOtherBotSecret.status, 401);
			assertEquals(queue.sent, []);
		});

		await t.step('webhook responde 500 quando a fila falha, para o Telegram reenviar', async () => {
			// Given
			queue.failing = true;

			// When
			const response = await worker.fetch(webhookRequest(textUpdate, webhookSecret), env, fakeExecutionContext);

			// Then
			queue.failing = false;
			assertEquals(response.status, 500);
		});

		await t.step('GET aguarda o setWebhook antes de responder', async () => {
			// Given
			state.calls.length = 0;

			// When
			const response = await worker.fetch(new Request('https://bot.example/'), env, fakeExecutionContext);

			// Then
			assertEquals(response.status, 200);
			assertEquals(await response.text(), 'Use with https://t.me/llm_gemini_bot');
			assertEquals(state.calls, ['setWebhook']);
		});

		await t.step('consumidor não cacheia inicialização que falhou e tenta de novo no próximo lote', async () => {
			// Given
			state.tokenRejected = true;
			const message = new FakeQueueMessage(textUpdate);
			const batch: UpdateQueueBatch = { messages: [message] };

			// When / Then
			await assertRejects(() => worker.queue(batch, env));
			assertEquals(message.acked, false);

			state.tokenRejected = false;
			await worker.queue(batch, env);
			assertEquals(message.acked, true);
		});

		await t.step('consumidor processa o update com o bot e confirma a mensagem', async () => {
			// Given
			state.calls.length = 0;
			const message = new FakeQueueMessage({ update_id: 43 } as Update);

			// When
			await worker.queue({ messages: [message] }, env);

			// Then
			assertEquals(message.acked, true);
			assertEquals(state.calls.includes('getMe'), false);
		});
	} finally {
		globalThis.fetch = originalFetch;
		setKeyValueStore(new InMemoryKeyValueStore());
	}
});
