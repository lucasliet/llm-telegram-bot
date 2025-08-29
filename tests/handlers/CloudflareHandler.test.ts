import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { setupKvStub } from '../stubs/kv.ts';
function createCtx(msg: string) {
	return {
		replyInChunks: spy(() => Promise.resolve()),
		replyWithPhoto: spy(() => Promise.resolve()),
		streamReply: spy(() => Promise.resolve()),
		extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:1', contextMessage: msg, photos: undefined, caption: undefined, quote: undefined })),
		message: { message_id: 10 },
	};
}

Deno.test('CloudflareHandler routes to text generation', async () => {
	const restore = setupKvStub();
	const ctx: any = createCtx('oss: hello');
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/CloudflareHandler.ts');
	const svc = await import('../../src/service/CloudFlareService.ts');
	(svc.default as any).generateText = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s }),
	);
	await mod.handleCloudflare(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	restore();
});

Deno.test('CloudflareHandler routes to image generation', async () => {
	const restore = setupKvStub();
	const ctx: any = {
		replyWithPhoto: spy(() => Promise.resolve()),
		extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:1', contextMessage: 'cloudflareimage: a tree', photos: undefined, caption: undefined, quote: undefined })),
		message: { message_id: 11 },
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/CloudflareHandler.ts');
	const svc = await import('../../src/service/CloudFlareService.ts');
	(svc.default as any).generateImage = spy(() => Promise.resolve(new Uint8Array([1, 2, 3])));
	await mod.handleCloudflare(ctx);
	assertEquals(ctx.replyWithPhoto.calls.length, 1);
	restore();
});
