import { assertEquals, assertRejects } from 'asserts';
import worker, { WorkerExecutionContext } from '../worker.ts';
import { mockDenoEnv } from './test_helpers.ts';
import { InMemoryKeyValueStore, KVNamespaceBinding, setKeyValueStore } from '@/repository/KeyValueStore.ts';

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

Deno.test('worker.ts', { sanitizeResources: false, sanitizeOps: false }, async (t) => {
	mockDenoEnv({ BOT_TOKEN: '123:test', ADMIN_USER_IDS: '1' });
	const originalFetch = globalThis.fetch;
	const state = { tokenRejected: true, calls: [] as string[] };
	globalThis.fetch = createTelegramFetch(state);
	const env = { KV: new FakeKVNamespace() };

	try {
		await t.step('não cacheia inicialização que falhou e tenta de novo no próximo request', async () => {
			// Given
			state.tokenRejected = true;

			// When / Then
			await assertRejects(() => worker.fetch(new Request('https://bot.example/'), env, fakeExecutionContext));

			state.tokenRejected = false;
			const response = await worker.fetch(new Request('https://bot.example/'), env, fakeExecutionContext);
			assertEquals(response.status, 200);
			assertEquals(await response.text(), 'Use with https://t.me/llm_gemini_bot');
		});

		await t.step('reutiliza o bot já inicializado e aguarda o setWebhook antes de responder', async () => {
			// Given
			state.calls.length = 0;

			// When
			const response = await worker.fetch(new Request('https://bot.example/'), env, fakeExecutionContext);

			// Then
			assertEquals(response.status, 200);
			assertEquals(state.calls, ['setWebhook']);
		});
	} finally {
		globalThis.fetch = originalFetch;
		setKeyValueStore(new InMemoryKeyValueStore());
	}
});
