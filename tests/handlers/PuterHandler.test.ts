import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('PuterHandler forwards to PuterService and streams', async () => {
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:1', contextMessage: 'claude: hello', photos: undefined, caption: undefined, quote: undefined })),
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/PuterHandler.ts');
	const svc = await import('../../src/service/PuterService.ts');
	(svc.default as any).generateText = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s }),
	);
	await mod.handlePuter(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	restore();
});
