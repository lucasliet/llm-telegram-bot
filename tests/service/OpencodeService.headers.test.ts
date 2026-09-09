import { assertEquals, assertMatch, assertNotEquals } from 'asserts';
import { buildOpencodeHeaders, newOpencodeOperationId, OPENCODE_SESSION_HEADER, OPENCODE_USER_AGENT } from '../../src/service/openai/OpencodeService.ts';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('buildOpencodeHeaders identifies client and operation', () => {
	const headers = buildOpencodeHeaders('op-123');
	assertEquals(headers['User-Agent'], OPENCODE_USER_AGENT);
	assertEquals(headers[OPENCODE_SESSION_HEADER], 'op-123');
});

Deno.test('newOpencodeOperationId generates unique ids', () => {
	const first = newOpencodeOperationId();
	const second = newOpencodeOperationId();
	assertMatch(first, /^[0-9a-f-]{36}$/i);
	assertNotEquals(first, second);
});

Deno.test('OpencodeService sends User-Agent and x-opencode-session', async () => {
	const restore = setupKvStub();
	try {
		const { default: OpencodeService } = await import('../../src/service/openai/OpencodeService.ts');
		const service = new OpencodeService('mimo-v2.5-free', 'fixed-operation-id') as any;
		const defaultHeaders = service.openai._options.defaultHeaders;
		assertEquals(defaultHeaders['User-Agent'], OPENCODE_USER_AGENT);
		assertEquals(defaultHeaders[OPENCODE_SESSION_HEADER], 'fixed-operation-id');
		assertEquals(service.getOperationId(), 'fixed-operation-id');
	} finally {
		restore();
	}
});

Deno.test('OpencodeService.setOperationId reapplies headers', async () => {
	const restore = setupKvStub();
	try {
		const { default: OpencodeService } = await import('../../src/service/openai/OpencodeService.ts');
		const service = new OpencodeService('mimo-v2.5-free', 'op-1') as any;
		service.setOperationId('op-2');
		const defaultHeaders = service.openai._options.defaultHeaders;
		assertEquals(defaultHeaders[OPENCODE_SESSION_HEADER], 'op-2');
		assertEquals(service.getOperationId(), 'op-2');
	} finally {
		restore();
	}
});

Deno.test('OpencodeService.generateText reuses the stable in-memory session', async () => {
	const restore = setupKvStub();
	const OpenAiService = (await import('../../src/service/openai/OpenAIService.ts')).default;
	const original = OpenAiService.prototype.generateText;
	(OpenAiService.prototype as any).generateText = function () {
		return Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s });
	};
	try {
		const { default: OpencodeService } = await import('../../src/service/openai/OpencodeService.ts');
		const service = new OpencodeService('mimo-v2.5-free', 'op-before') as any;
		await service.generateText('user:1', '', 'hi');
		const after = service.getOperationId();
		const second = new OpencodeService('mimo-v2.5-free') as any;
		assertEquals(after, second.getOperationId());
		const defaultHeaders = service.openai._options.defaultHeaders;
		assertEquals(defaultHeaders['User-Agent'], OPENCODE_USER_AGENT);
		assertEquals(defaultHeaders[OPENCODE_SESSION_HEADER], after);
	} finally {
		OpenAiService.prototype.generateText = original;
		restore();
	}
});
