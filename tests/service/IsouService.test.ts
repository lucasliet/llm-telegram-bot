import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('IsouService.generateText returns reader and onComplete', async () => {
	const restore = setupKvStub();
	const svc = await import('../../src/service/IsouService.ts');
	const originalFetch = globalThis.fetch;
	try {
		const stream = new ReadableStream({ start(c){ c.enqueue(new TextEncoder().encode('data: {"data":"{\"content\":\"Hello\"}"}\n')); c.close(); } });
		globalThis.fetch = spy(() => Promise.resolve(new Response(stream, { status: 200 }))) as any;
		const { reader, onComplete, responseMap } = await (svc.default as any).generateText('user:1', '', 'hi');
		const chunk = await reader.read();
		assertEquals(chunk.done, false);
		const mapped = responseMap('data: {"data":"{\"content\":\"Hi\"}"}\n');
		assertEquals(typeof mapped, 'string');
		if (onComplete) await onComplete('done');
	} finally {
		globalThis.fetch = originalFetch;
		restore();
	}
});
