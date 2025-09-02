import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('PhindHandler forwards to service and streams', async () => {
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		extractContextKeys: spy(() =>
			Promise.resolve({ userKey: 'user:1', contextMessage: 'phind: coding', photos: undefined, caption: undefined, quote: undefined })
		),
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/PhindHandler.ts');
	const svc = await import('../../src/service/PhindService.ts');
	(svc.PhindService as any).prototype.generateText = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s })
	);
	await mod.handlePhind(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	restore();
});
