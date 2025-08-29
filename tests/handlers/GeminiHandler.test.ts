import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { mockDenoEnv } from '../test_helpers.ts';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('GeminiHandler streams text generation', async () => {
	mockDenoEnv({ GEMINI_API_KEY: 'x' });
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:1', contextMessage: 'gemini: hello', photos: undefined, caption: undefined, quote: undefined })),
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/GeminiHandler.ts');
	const svc = await import('../../src/service/openai/GeminiService.ts');
	(svc.default as any).prototype.generateText = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s }),
	);
	await mod.handleGemini(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	restore();
});

Deno.test('GeminiHandler streams image generation flow', async () => {
	mockDenoEnv({ GEMINI_API_KEY: 'x' });
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:1', contextMessage: undefined, photos: [{}], caption: 'gemini: caption', quote: undefined })),
	};
	const fu = await import('../../src/util/FileUtils.ts');
	(fu.FileUtils as any).getTelegramFilesUrl = spy(() => ['https://file/1']);
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/GeminiHandler.ts');
	const svc = await import('../../src/service/openai/GeminiService.ts');
	(svc.default as any).prototype.generateTextFromImage = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s }),
	);
	await mod.handleGemini(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	restore();
});
