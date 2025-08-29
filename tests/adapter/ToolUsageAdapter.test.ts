import { assertEquals } from 'asserts';
import '../../src/prototype/ReadableStreamDefaultReaderPrototype.ts';
let ToolUsageAdapter: any;
let AdapterClass: any;

/**
 * Creates a reader from given string chunks.
 * @param chunks - Text chunks to emit in sequence.
 * @returns Reader that yields encoded chunks.
 */
function readerFromChunks(chunks: string[]) {
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const c of chunks) controller.enqueue(encoder.encode(c));
			controller.close();
		},
	});
	return stream.getReader();
}

Deno.test('modifyMessagesWithToolInfo converts tool message and appends tools info', async () => {
	const originalOpenKv = Deno.openKv;
	Deno.openKv = () =>
		Promise.resolve(
			{
				get: () => Promise.resolve({ value: undefined }),
				set: () => Promise.resolve({ ok: true }),
				delete: () => Promise.resolve({ ok: true }),
				close: () => Promise.resolve(),
			} as any,
		);
	({ default: ToolUsageAdapter, ToolUsageAdapter: AdapterClass } = await import('../../src/adapter/ToolUsageAdapter.ts'));
	const messages = [
		{ role: 'user', content: 'hi' } as any,
		{ role: 'tool', content: 'result', tool_call_id: 'id1' } as any,
		{ role: 'user', content: 'ask' } as any,
	];
	const toolOptions = {
		tools: [{ type: 'function', function: { name: 'x', description: 'd', parameters: { type: 'object', properties: {} } } }] as any,
	};
	const modified = ToolUsageAdapter.modifyMessagesWithToolInfo(messages as any, toolOptions as any);
	const toolMsg = modified.find((m) => (m as any).role === 'assistant');
	const lastUser = modified[modified.length - 1] as any;
	const ok = toolMsg && typeof (toolMsg as any).content === 'string' && lastUser.content.includes('You have access to the following tools');
	assertEquals(!!ok, true);
	Deno.openKv = originalOpenKv;
});

Deno.test('mapResponse formats as OpenAI chunk when requested', async () => {
	const originalOpenKv = Deno.openKv;
	Deno.openKv = () =>
		Promise.resolve(
			{
				get: () => Promise.resolve({ value: undefined }),
				set: () => Promise.resolve({ ok: true }),
				delete: () => Promise.resolve({ ok: true }),
				close: () => Promise.resolve(),
			} as any,
		);
	({ default: ToolUsageAdapter, ToolUsageAdapter: AdapterClass } = await import('../../src/adapter/ToolUsageAdapter.ts'));
	const reader = readerFromChunks(['hello']);
	const mapped = ToolUsageAdapter.mapResponse(reader, true);
	const text = await (mapped as any).text();
	const parsed = JSON.parse(text);
	assertEquals(parsed.choices[0].delta.content, 'hello');
	Deno.openKv = originalOpenKv;
});

Deno.test('AdapterClass._createOpenAIStreamChunk behavior via mapResponse passthrough', async () => {
	const originalOpenKv = Deno.openKv;
	Deno.openKv = () =>
		Promise.resolve(
			{
				get: () => Promise.resolve({ value: undefined }),
				set: () => Promise.resolve({ ok: true }),
				delete: () => Promise.resolve({ ok: true }),
				close: () => Promise.resolve(),
			} as any,
		);
	({ default: ToolUsageAdapter, ToolUsageAdapter: AdapterClass } = await import('../../src/adapter/ToolUsageAdapter.ts'));
	const reader = readerFromChunks(['a', 'b']);
	const mapped = ToolUsageAdapter.mapResponse(reader, false, (s) => s.toUpperCase());
	const text = await (mapped as any).text();
	assertEquals(text, 'AB');
	Deno.openKv = originalOpenKv;
});

Deno.test('extractToolCallsFromStream detects tool blocks and formats adapter payload', async () => {
	const originalOpenKv = Deno.openKv;
	Deno.openKv = () =>
		Promise.resolve(
			{
				get: () => Promise.resolve({ value: undefined }),
				set: () => Promise.resolve({ ok: true }),
				delete: () => Promise.resolve({ ok: true }),
				close: () => Promise.resolve(),
			} as any,
		);
	({ default: ToolUsageAdapter, ToolUsageAdapter: AdapterClass } = await import('../../src/adapter/ToolUsageAdapter.ts'));
	const adapter = new AdapterClass();
	const content = 'pre ```function\n{ "name": "fetch", "arguments": {"url":"https://example.com"} }\n``` post';
	const reader = readerFromChunks([content]);
	const extracted = (adapter as any)._extractToolCallsFromStream(reader);
	const text = await (extracted as any).text();
	const hasAdapterKey = text.includes('__adapter_tool_calls');
	assertEquals(hasAdapterKey, true);
	Deno.openKv = originalOpenKv;
});

Deno.test('formatStreamToOpenAIInterface maps adapter tool calls to OpenAI chunks', async () => {
	const originalOpenKv = Deno.openKv;
	Deno.openKv = () =>
		Promise.resolve(
			{
				get: () => Promise.resolve({ value: undefined }),
				set: () => Promise.resolve({ ok: true }),
				delete: () => Promise.resolve({ ok: true }),
				close: () => Promise.resolve(),
			} as any,
		);
	({ default: ToolUsageAdapter, ToolUsageAdapter: AdapterClass } = await import('../../src/adapter/ToolUsageAdapter.ts'));
	const adapter = new AdapterClass();
	const payload = JSON.stringify({ __adapter_tool_calls: [{ index: 0, function: { name: 'fetch', arguments: '{"url":"x"}' } }] });
	const reader = readerFromChunks([payload]);
	const formatted = (adapter as any)._formatStreamToOpenAIInterface(reader);
	const text = await (formatted as any).text();
	const hasToolCalls = text.includes('tool_calls');
	assertEquals(hasToolCalls, true);
	Deno.openKv = originalOpenKv;
});
