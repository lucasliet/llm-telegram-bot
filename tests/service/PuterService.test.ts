import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('PuterService.generateText returns reader and onComplete', async () => {
	const restoreKv = setupKvStub();
	const envGet = Deno.env.get;
	Deno.env.get = (k: string) => (k === 'PUTER_TOKEN' ? 'x' : envGet(k)) as any;
	const svc = await import('../../src/service/PuterService.ts');
	const originalFetch = globalThis.fetch;
	try {
		const stream = new ReadableStream({ start(c){ c.enqueue(new TextEncoder().encode('{"text":"Hello"}')); c.close(); } });
		globalThis.fetch = spy(() => Promise.resolve(new Response(stream, { status: 200 }))) as any;
		const { reader, onComplete, responseMap } = await (svc.default as any).generateText('user:1', '', 'hi');
		const chunk = await reader.read();
		assertEquals(chunk.done, false);
		if (onComplete) await onComplete('ok');
		assertEquals(responseMap('{"text":"X"}'), 'X');
	} finally {
		globalThis.fetch = originalFetch;
		Deno.env.get = envGet;
		restoreKv();
	}
});
