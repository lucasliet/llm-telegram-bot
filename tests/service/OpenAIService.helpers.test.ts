import { assertEquals } from 'asserts';

function readerFromLines(lines: string[]): ReadableStreamDefaultReader<Uint8Array> {
	const enc = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(c) {
			for (const l of lines) c.enqueue(enc.encode(l));
			c.close();
		},
	}).getReader();
}

Deno.test('OpenAIService.executeToolCalls parses tool_calls and forwards followup', async () => {
	const { setupKvStub } = await import('../stubs/kv.ts');
	setupKvStub();
	const mod = await import('../../src/service/openai/OpenAIService.ts');
	const tools = await import('../../src/service/ToolService.ts');
	(tools.default as any).tools.set('echo', { schema: {} as any, fn: (args: any) => ({ ok: args?.q }) });
	const initial = readerFromLines([
		JSON.stringify({ choices: [{ delta: { content: 'x' } }] }),
		JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: '1', function: { name: 'echo', arguments: '{"q":"z"}' } }] } }] }),
	]);
	const follow = readerFromLines([JSON.stringify({ choices: [{ delta: { content: 'y' } }] })]);
	const reader = mod.executeToolCalls((() => Promise.resolve(follow)) as any, initial, []);
	const dec = new TextDecoder();
	let assembled = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		const raw = dec.decode(value);
		assembled += mod.responseMap(raw) || '';
	}
	assertEquals(assembled.includes('y'), true);
});
