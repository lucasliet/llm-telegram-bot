import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { mockDenoEnv } from '../test_helpers.ts';
import { setupKvStub } from '../stubs/kv.ts';

const streamResponse = () => Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s });

Deno.test('ZaiService sends images as base64 because Z.ai cannot fetch Telegram URLs', async () => {
	mockDenoEnv({ ZHIPU_API_KEY: 'x' });
	const restore = setupKvStub();

	await import('../../src/service/TelegramService.ts');
	const base = await import('../../src/service/openai/OpenAIService.ts');
	const svc = await import('../../src/service/openai/ZaiService.ts');

	const superGenerate = spy(streamResponse);
	(base.default as any).prototype.generateTextFromImage = superGenerate;
	(svc.default as any).prototype.generateText = spy(() => {
		throw new Error('text path should not run');
	});

	await (svc.default as any).prototype.generateTextFromImage.call(
		new (svc.default as any)(),
		'user:1',
		undefined,
		[Promise.resolve('https://file/1')] as any,
		'descreva a imagem',
	);

	assertEquals(superGenerate.calls.length, 1);
	assertEquals(superGenerate.calls[0].args[4], true);

	restore();
});

Deno.test('ZaiHandler accepts image input for vision-capable flash model', async () => {
	mockDenoEnv({ ZHIPU_API_KEY: 'x' });
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		replyWithVisionNotSupportedByModel: spy(() => Promise.resolve()),
		extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:1', contextMessage: undefined, photos: [{}], caption: 'o que é isso?', quote: undefined })),
	};
	await import('../../src/service/TelegramService.ts');
	const fu = await import('../../src/util/FileUtils.ts');
	(fu.FileUtils as any).getTelegramFilesUrl = spy(() => ['https://file/1']);
	const mod = await import('../../src/handlers/ZaiHandler.ts');
	const svc = await import('../../src/service/openai/ZaiService.ts');
	const generateTextFromImage = spy(streamResponse);
	(svc.default as any).prototype.generateTextFromImage = generateTextFromImage;
	(svc.default as any).prototype.generateText = spy(() => {
		throw new Error('text path should not run for photo messages');
	});
	await mod.handleZai(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	assertEquals(ctx.replyWithVisionNotSupportedByModel.calls.length, 0);
	restore();
});

Deno.test('ZaiHandler rejects image input for text-only glm model', async () => {
	mockDenoEnv({ ZHIPU_API_KEY: 'x' });
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		replyWithVisionNotSupportedByModel: spy(() => Promise.resolve()),
		extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:1', contextMessage: undefined, photos: [{}], caption: 'descreva', quote: undefined })),
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/ZaiHandler.ts');
	const svc = await import('../../src/service/openai/ZaiService.ts');
	(svc.default as any).prototype.generateTextFromImage = spy(() => {
		throw new Error('vision path should not run for glm model');
	});
	await mod.handleZai(ctx, 'glm: descreva');
	assertEquals(ctx.replyWithVisionNotSupportedByModel.calls.length, 1);
	assertEquals(ctx.streamReply.calls.length, 0);
	restore();
});

Deno.test('ZaiHandler keeps text flow for text-only glm model', async () => {
	mockDenoEnv({ ZHIPU_API_KEY: 'x' });
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		replyWithVisionNotSupportedByModel: spy(() => Promise.resolve()),
		extractContextKeys: spy(() => Promise.resolve({ userKey: 'user:1', contextMessage: 'glm: oi', photos: undefined, caption: undefined, quote: undefined })),
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/ZaiHandler.ts');
	const svc = await import('../../src/service/openai/ZaiService.ts');
	(svc.default as any).prototype.generateText = spy(streamResponse);
	await mod.handleZai(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	assertEquals(ctx.replyWithVisionNotSupportedByModel.calls.length, 0);
	restore();
});
