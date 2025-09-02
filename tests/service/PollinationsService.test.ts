import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('PollinationsService.generateText returns reader and onComplete', async () => {
	const restore = setupKvStub();
	const svc = await import('../../src/service/PollinationsService.ts');
	const originalFetch = globalThis.fetch;
	try {
		const stream = new ReadableStream({
			start(c) {
				c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
				c.close();
			},
		});
		globalThis.fetch = spy(() => Promise.resolve(new Response(stream, { status: 200 }))) as any;
		const { reader, onComplete, responseMap } = await (svc.default as any).generateText('user:1', '', 'hello', 'polli');
		const { done } = await reader.read();
		assertEquals(done, false);
		if (onComplete) await onComplete('ok');
		assertEquals(typeof responseMap('data: test'), 'string');
	} finally {
		globalThis.fetch = originalFetch;
		restore();
	}
});

Deno.test('PollinationsService.generateImage returns pollinations URL', async () => {
	setupKvStub();
	const svc = await import('../../src/service/PollinationsService.ts');
	const url = await (svc.default as any).generateImage('a prompt');
	assertEquals(url.includes('image.pollinations.ai'), true);
});
