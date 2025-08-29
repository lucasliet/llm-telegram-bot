import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { setupKvStub } from '../stubs/kv.ts';
function createCtx() {
	return {
		reply: spy(() => Promise.resolve()),
		replyWithPhoto: spy(() => Promise.resolve()),
		extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:1', contextMessage: 'artaImage: draw a cat', photos: undefined, caption: undefined, quote: undefined })),
	};
}

Deno.test('ArtaHandler generates image and replies with photo', async () => {
	const restore = setupKvStub();
	const ctx: any = createCtx();
	const svc = await import('../../src/service/ArtaService.ts');
	(svc.default as any).generateImage = spy(() => Promise.resolve('https://img/arta.png'));
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/ArtaHandler.ts');
	await mod.handleArta(ctx);
	assertEquals(ctx.replyWithPhoto.calls.length, 1);
	restore();
});
