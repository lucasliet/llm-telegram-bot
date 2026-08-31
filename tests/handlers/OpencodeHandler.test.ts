import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('OpencodeHandler streams text path', async () => {
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		replyWithVisionNotSupportedByModel: spy(() => Promise.resolve()),
		extractContextKeys: spy(() =>
			Promise.resolve({
				userKey: 'user:1',
				contextMessage: 'opencode: hi',
				photos: undefined,
				caption: undefined,
				quote: undefined,
			})
		),
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/OpencodeHandler.ts');
	const svc = await import('../../src/service/openai/OpencodeService.ts');
	(svc.default as any).prototype.generateText = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s })
	);
	await mod.handleOpencode(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	restore();
});

Deno.test('OpencodeHandler streams image generation flow', async () => {
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		replyWithVisionNotSupportedByModel: spy(() => Promise.resolve()),
		extractContextKeys: spy(() =>
			Promise.resolve({ userKey: 'user:1', contextMessage: undefined, photos: [{}], caption: 'opencode: caption', quote: undefined })
		),
	};
	const fu = await import('../../src/util/FileUtils.ts');
	(fu.FileUtils as any).getTelegramFilesUrl = spy(() => ['https://file/1']);
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/OpencodeHandler.ts');
	const svc = await import('../../src/service/openai/OpencodeService.ts');
	(svc.default as any).prototype.generateTextFromImage = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s })
	);
	await mod.handleOpencode(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	assertEquals((svc.default as any).prototype.generateTextFromImage.calls.length, 1);
	restore();
});
