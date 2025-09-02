import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { setupKvStub } from '../stubs/kv.ts';
import '../../src/prototype/ReadableStreamDefaultReaderPrototype.ts';
import '../../src/prototype/StringExtensionPrototype.ts';

Deno.test('BlackboxHandler image path replies with photo', async () => {
	const restore = setupKvStub();
	const ctx: any = {
		replyWithPhoto: spy(() => Promise.resolve()),
		extractContextKeys: spy(() =>
			Promise.resolve({ userKey: 'user:1', contextMessage: 'image: a dog', photos: undefined, caption: undefined, quote: undefined })
		),
		message: { message_id: 5 },
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/BlackboxHandler.ts');
	const svc = await import('../../src/service/BlackboxaiService.ts');
	(svc.default as any).generateImage = spy(() => Promise.resolve('https://img/bbx.png'));
	await mod.handleBlackbox(ctx);
	assertEquals(ctx.replyWithPhoto.calls.length, 1);
	restore();
});

Deno.test('BlackboxHandler default text path streams', async () => {
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:1', contextMessage: 'gpt: hi', photos: undefined, caption: undefined, quote: undefined })),
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/BlackboxHandler.ts');
	const svc = await import('../../src/service/BlackboxaiService.ts');
	(svc.default as any).generateText = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s })
	);
	await mod.handleBlackbox(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	restore();
});
