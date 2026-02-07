import { assertEquals, assertExists } from 'asserts';
import { cacheSignature, defaultSignatureStore, getCachedSignature } from '@/service/antigravity/AntigravityCache.ts';

Deno.test('AntigravityCache - deve armazenar e recuperar signature', () => {
	const sessionId = 'test-session';
	const text = 'thinking content here';
	const signature = 'x'.repeat(50);

	cacheSignature(sessionId, text, signature);
	const retrieved = getCachedSignature(sessionId, text);

	assertEquals(retrieved, signature);
});

Deno.test('AntigravityCache - deve retornar undefined para cache miss', () => {
	const result = getCachedSignature('non-existent', 'text');
	assertEquals(result, undefined);
});

Deno.test('AntigravityCache - deve expirar entradas antigas', () => {
	const sessionId = 'test-session-expire';
	const text = 'thinking content';
	const signature = 'y'.repeat(50);

	cacheSignature(sessionId, text, signature);

	(defaultSignatureStore as any).cache.forEach((value: any) => {
		value.timestamp = Date.now() - 4000000;
	});

	const result = getCachedSignature(sessionId, text);
	assertEquals(result, undefined);
});

Deno.test('AntigravityCache - deve lidar com múltiplas entradas na mesma sessão', () => {
	const sessionId = 'test-session-multi';
	const entries = [
		{ text: 'thinking 1', signature: 'a'.repeat(50) },
		{ text: 'thinking 2', signature: 'b'.repeat(50) },
		{ text: 'thinking 3', signature: 'c'.repeat(50) },
	];

	for (const entry of entries) {
		cacheSignature(sessionId, entry.text, entry.signature);
	}

	for (const entry of entries) {
		const retrieved = getCachedSignature(sessionId, entry.text);
		assertEquals(retrieved, entry.signature);
	}
});

Deno.test('AntigravityCache - deve ter entradas', () => {
	const sessionId = 'test-session-has';
	cacheSignature(sessionId, 'text', 'x'.repeat(50));

	const hasEntry = defaultSignatureStore.has(sessionId);
	assertExists(hasEntry);
});

Deno.test('AntigravityCache - deve limpar entradas expiradas', () => {
	const sessionId = 'test-session-cleanup';
	cacheSignature(sessionId, 'text', 'x'.repeat(50));

	const statsBefore = defaultSignatureStore.getStats();
	assertExists(statsBefore);

	(defaultSignatureStore as any).cache.forEach((value: any) => {
		value.timestamp = Date.now() - 4000000;
	});

	defaultSignatureStore.cleanup();

	const statsAfter = defaultSignatureStore.getStats();
	assertExists(statsAfter);
	assertEquals(statsAfter.totalEntries, 0);
});

Deno.test('AntigravityCache - deve retornar undefined para texto vazio', () => {
	const sessionId = 'test-session-empty';
	const result = getCachedSignature(sessionId, '');
	assertEquals(result, undefined);
});

Deno.test('AntigravityCache - deve retornar undefined para signature vazia', () => {
	const sessionId = 'test-session-empty-sig';
	cacheSignature(sessionId, 'text', '');

	const result = getCachedSignature(sessionId, 'text');
	assertEquals(result, undefined);
});

Deno.test('AntigravityCache - deve limpar todas as entradas', () => {
	cacheSignature('session1', 'text1', 'x'.repeat(50));
	cacheSignature('session2', 'text2', 'y'.repeat(50));

	defaultSignatureStore.clear();

	const stats = defaultSignatureStore.getStats();
	assertExists(stats);
	assertEquals(stats.totalEntries, 0);
	assertEquals(stats.sessions, 0);
});
