import { assertEquals } from 'asserts';
import { assertSpyCalls, spy } from 'mock';
import '../../src/prototype/StringExtensionPrototype.ts';
import { Context } from 'grammy';


Deno.env.set('ADMIN_USER_IDS', '123');

/**
 * Creates a mock Context-like object with minimal API used by extensions.
 * @param overrides - Optional overrides for default fields.
 * @returns A mock context object.
 */
function createContext(overrides: Partial<any> = {}) {
	const base: any = {
		chat: { id: 1 },
		from: { id: 123 },
		message: { text: 'ping', message_id: 10 },
		api: { editMessageText: spy(() => Promise.resolve()) },
		reply: spy((text: string) => Promise.resolve({ text, message_id: 10 })),
		replyWithQuote: undefined,
		replyInChunks: undefined,
		streamReply: undefined,
		extractContextKeys: undefined,
	};
	return Object.assign(base, overrides);
}

Deno.test('replyInChunks splits large messages and calls replyWithQuote', async () => {
	const originalOpenKv = Deno.openKv;
	Deno.openKv = () =>
		Promise.resolve(
			{
				get: () => Promise.resolve({ value: [] }),
				set: () => Promise.resolve({ ok: true }),
				delete: () => Promise.resolve({ ok: true }),
				close: () => Promise.resolve(),
			} as any,
		);
	const calls: any[] = [];
	const ctx = createContext({
		replyWithQuote: spy((text: string) => {
			calls.push(text);
			return Promise.resolve({ message_id: 10 });
		}),
	});
	const big = 'x'.repeat(5000);
	await import('../../src/prototype/ContextExtensionPrototype.ts');
	await (Context.prototype as any).replyInChunks.call(ctx, big);
	const ok = calls.length >= 2;
	assertEquals(ok, true);
	Deno.openKv = originalOpenKv;
});

Deno.test('replyInChunks fallback removes Markdown when reply fails', async () => {
	const originalOpenKv = Deno.openKv;
	Deno.openKv = () =>
		Promise.resolve(
			{
				get: () => Promise.resolve({ value: [] }),
				set: () => Promise.resolve({ ok: true }),
				delete: () => Promise.resolve({ ok: true }),
				close: () => Promise.resolve(),
			} as any,
		);
	let first = true;
	const calls: any[] = [];
	const ctx = createContext({
		replyWithQuote: spy((text: string, cfg?: any) => {
			calls.push(cfg);
			if (first) {
				first = false;
				return Promise.reject(new Error('md'));
			}
			return Promise.resolve({ message_id: 10 });
		}),
	});
	await import('../../src/prototype/ContextExtensionPrototype.ts');
	await (Context.prototype as any).replyInChunks.call(ctx, 'small');
	const attemptedMarkdown = calls[0]?.parse_mode === 'Markdown';
	const attemptedFallback = !calls[1];
	assertEquals(attemptedMarkdown && attemptedFallback, true);
	Deno.openKv = originalOpenKv;
});

Deno.test('replyWithVisionNotSupportedByModel answers expected text', async () => {
	const originalOpenKv = Deno.openKv;
	Deno.openKv = () =>
		Promise.resolve(
			{
				get: () => Promise.resolve({ value: [] }),
				set: () => Promise.resolve({ ok: true }),
				delete: () => Promise.resolve({ ok: true }),
				close: () => Promise.resolve(),
			} as any,
		);
	const ctx = createContext({
		replyWithQuote: spy((text: string) => {
			return (ctx as any).reply(text);
		}),
	});
	await import('../../src/prototype/ContextExtensionPrototype.ts');
	await (Context.prototype as any).replyWithVisionNotSupportedByModel.call(ctx);
	assertEquals(ctx.reply.calls[0].args[0], 'esse modelo não suporta leitura de foto');
	Deno.openKv = originalOpenKv;
});

Deno.test('streamReply edits message and calls onComplete', async () => {
	const originalOpenKv = Deno.openKv;
	Deno.openKv = () =>
		Promise.resolve(
			{
				get: () => Promise.resolve({ value: [] }),
				set: () => Promise.resolve({ ok: true }),
				delete: () => Promise.resolve({ ok: true }),
				close: () => Promise.resolve(),
			} as any,
		);
	const ctx = createContext({
		replyWithQuote: spy(() => Promise.resolve({ message_id: 11 })),
	});
	const encoder = new TextEncoder();
	const reader = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode('Hello'));
			controller.enqueue(encoder.encode(' world'));
			controller.close();
		},
	}).getReader();
	const onComplete = spy(() => Promise.resolve());
	await import('../../src/prototype/ContextExtensionPrototype.ts');
	await (Context.prototype as any).streamReply.call(ctx, { reader, onComplete });
	assertEquals(ctx.api.editMessageText.calls.length > 0, true);
	assertEquals(onComplete.calls.length, 1);
	Deno.openKv = originalOpenKv;
});

Deno.test('extractContextKeys returns expected payload', async () => {
	const originalOpenKv = Deno.openKv;
	Deno.openKv = () =>
		Promise.resolve(
			{
				get: () => Promise.resolve({ value: [] }),
				set: () => Promise.resolve({ ok: true }),
				delete: () => Promise.resolve({ ok: true }),
				close: () => Promise.resolve(),
			} as any,
		);
	const ctx = createContext({
		message: { text: 'hello', message_id: 22 },
	});
	await import('../../src/prototype/ContextExtensionPrototype.ts');
	const keys = await (Context.prototype as any).extractContextKeys.call(ctx);
	const ok = keys.userId === 123 && keys.userKey === 'user:123' && keys.contextMessage === 'hello';
	assertEquals(ok, true);
	Deno.openKv = originalOpenKv;
});

Deno.test('startTypingIndicator sets chat action and returns interval', async () => {
	await import('../../src/prototype/ContextExtensionPrototype.ts');

	const mockSetInterval = spy(() => 123);
	globalThis.setInterval = mockSetInterval;

	const ctx = createContext();
	const id = (Context.prototype as any).startTypingIndicator.call(ctx);

	assertEquals(id, 123);
	assertEquals(ctx.chatAction, 'typing');
	assertSpyCalls(mockSetInterval, 1);
	assertEquals((mockSetInterval.calls[0] as any).args[1], 4000);
});
