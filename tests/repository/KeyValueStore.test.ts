import { assertEquals } from 'asserts';
import { CloudflareKeyValueStore, InMemoryKeyValueStore, KVNamespaceBinding } from '@/repository/KeyValueStore.ts';

class FakeKVNamespace implements KVNamespaceBinding {
	readonly values = new Map<string, string>();
	readonly putOptions = new Map<string, { expiration?: number } | undefined>();

	get(key: string, _type: 'json'): Promise<unknown> {
		const raw = this.values.get(key);
		return Promise.resolve(raw === undefined ? null : JSON.parse(raw));
	}

	put(key: string, value: string, options?: { expiration?: number }): Promise<void> {
		this.values.set(key, value);
		this.putOptions.set(key, options);
		return Promise.resolve();
	}

	delete(key: string): Promise<void> {
		this.values.delete(key);
		return Promise.resolve();
	}
}

Deno.test('InMemoryKeyValueStore', async (t) => {
	await t.step('retorna null para chave inexistente', async () => {
		// Given
		const store = new InMemoryKeyValueStore();

		// When
		const value = await store.get('missing');

		// Then
		assertEquals(value, null);
	});

	await t.step('armazena cópia defensiva do valor', async () => {
		// Given
		const store = new InMemoryKeyValueStore();
		const original = { triedModels: ['a'] };
		await store.set('state', original);

		// When
		original.triedModels.push('b');
		const value = await store.get<{ triedModels: string[] }>('state');

		// Then
		assertEquals(value, { triedModels: ['a'] });
	});

	await t.step('descarta valor expirado', async () => {
		// Given
		const store = new InMemoryKeyValueStore();
		await store.set('session', { ok: true }, { expiresAt: new Date(Date.now() - 1000) });

		// When
		const value = await store.get('session');

		// Then
		assertEquals(value, null);
	});

	await t.step('remove chave com delete', async () => {
		// Given
		const store = new InMemoryKeyValueStore();
		await store.set('state', { ok: true });

		// When
		await store.delete('state');

		// Then
		assertEquals(await store.get('state'), null);
	});
});

Deno.test('CloudflareKeyValueStore', async (t) => {
	await t.step('serializa e lê valores como JSON', async () => {
		// Given
		const namespace = new FakeKVNamespace();
		const store = new CloudflareKeyValueStore(namespace);

		// When
		await store.set('state', { currentModel: 'x', triedModels: [] });

		// Then
		assertEquals(namespace.values.get('state'), '{"currentModel":"x","triedModels":[]}');
		assertEquals(await store.get('state'), { currentModel: 'x', triedModels: [] });
	});

	await t.step('retorna null para chave inexistente', async () => {
		// Given
		const store = new CloudflareKeyValueStore(new FakeKVNamespace());

		// When
		const value = await store.get('missing');

		// Then
		assertEquals(value, null);
	});

	await t.step('converte expiração para segundos epoch', async () => {
		// Given
		const namespace = new FakeKVNamespace();
		const store = new CloudflareKeyValueStore(namespace);

		// When
		await store.set('session', { ok: true }, { expiresAt: new Date('2030-01-01T00:00:00.500Z') });

		// Then
		assertEquals(namespace.putOptions.get('session'), { expiration: 1893456000 });
	});

	await t.step('remove chave com delete', async () => {
		// Given
		const namespace = new FakeKVNamespace();
		const store = new CloudflareKeyValueStore(namespace);
		await store.set('state', { ok: true });

		// When
		await store.delete('state');

		// Then
		assertEquals(namespace.values.has('state'), false);
	});
});
