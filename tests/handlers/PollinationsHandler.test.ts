import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('PollinationsHandler streams text path', async () => {
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:1', contextMessage: 'polli: hi', photos: undefined, caption: undefined, quote: undefined })),
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/PollinationsHandler.ts');
	const svc = await import('../../src/service/PollinationsService.ts');
	(svc.default as any).prototype.generateText = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s })
	);
	await mod.handlePollinations(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	restore();
});

Deno.test('PollinationsHandler image path replies with photo', async () => {
	const restore = setupKvStub();
	const ctx: any = {
		replyWithPhoto: spy(() => Promise.resolve()),
		extractContextKeys: spy(() =>
			Promise.resolve({ userKey: 'user:1', contextMessage: 'polliimage: tree', photos: undefined, caption: undefined, quote: undefined })
		),
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/PollinationsHandler.ts');
	const svc = await import('../../src/service/PollinationsService.ts');
	(svc.default as any).prototype.generateImage = spy(() => Promise.resolve('https://img/polli.png'));
	await mod.handlePollinations(ctx);
	assertEquals(ctx.replyWithPhoto.calls.length, 1);
	restore();
});
