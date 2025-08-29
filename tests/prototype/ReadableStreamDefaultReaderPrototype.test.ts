import { assertEquals } from 'asserts';
import '../../src/prototype/ReadableStreamDefaultReaderPrototype.ts';

/**
 * Creates a ReadableStreamDefaultReader that yields the provided chunks.
 * @param chunks - List of string chunks to emit in order.
 * @returns A reader for the created stream.
 */
function createReader(chunks: string[]) {
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const c of chunks) controller.enqueue(encoder.encode(c));
			controller.close();
		},
	});
	return stream.getReader();
}

Deno.test('ReadableStreamDefaultReader.prototype.text concatenates chunks', async () => {
	const reader = createReader(['hello', ' ', 'world']);
	const text = await (reader as any).text();
	assertEquals(text, 'hello world');
});
