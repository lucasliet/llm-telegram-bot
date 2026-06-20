import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { mockDenoEnv } from '../test_helpers.ts';
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

Deno.test('CloudflareHandler routes kimi text command to generateText', async () => {
	const restore = setupKvStub();
	mockDenoEnv({ CLOUDFLARE_API_KEY: 'k', CLOUDFLARE_ACCOUNT_ID: 'acc' });
	const ctx: any = createCtx('kimi: hello');
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/CloudflareHandler.ts');
	const { default: CloudFlareService } = await import('../../src/service/openai/CloudFlareService.ts');
	const generateTextSpy = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s })
	);
	CloudFlareService.prototype.generateText = generateTextSpy;
	await mod.handleCloudflare(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	assertEquals(generateTextSpy.calls.length, 1);
	restore();
});

Deno.test('CloudflareHandler routes to image generation', async () => {
	const restore = setupKvStub();
	mockDenoEnv({ CLOUDFLARE_API_KEY: 'k', CLOUDFLARE_ACCOUNT_ID: 'acc' });
	const ctx: any = {
		replyWithPhoto: spy(() => Promise.resolve()),
		extractContextKeys: spy(() =>
			Promise.resolve({ userKey: 'user:1', contextMessage: 'cloudflareimage: a tree', photos: undefined, caption: undefined, quote: undefined })
		),
		message: { message_id: 11 },
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/CloudflareHandler.ts');
	const { default: CloudFlareService } = await import('../../src/service/openai/CloudFlareService.ts');
	const generateImageSpy = spy(() => Promise.resolve(new Uint8Array([1, 2, 3])));
	CloudFlareService.prototype.generateImageBinary = generateImageSpy;
	await mod.handleCloudflare(ctx);
	assertEquals(ctx.replyWithPhoto.calls.length, 1);
	assertEquals(generateImageSpy.calls.length, 1);
	restore();
});
