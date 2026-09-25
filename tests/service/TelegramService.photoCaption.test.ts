import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { mockDenoEnv } from '../test_helpers.ts';
import { assignOpenKv } from '../stubs/kv.ts';

const streamResponse = () =>
	Promise.resolve({
		reader: new ReadableStream().getReader(),
		onComplete: () => Promise.resolve(),
		responseMap: (s: string) => s,
	});

function stubKvWithCurrentModel(model: string): () => void {
	const originalOpenKv = Deno.openKv;
	const mockKv = {
		get: (key: unknown[]) => Promise.resolve({ value: key[1] === 'current_model' ? model : undefined }),
		set: () => Promise.resolve({ ok: true }),
		delete: () => Promise.resolve({ ok: true }),
		close: () => Promise.resolve(),
	};
	assignOpenKv(() => Promise.resolve(mockKv as unknown as Deno.Kv));
	return () => assignOpenKv(originalOpenKv);
}

Deno.test('replyTextContent forwards photo caption to vision handler when message has no text', async () => {
	mockDenoEnv({ ZHIPU_API_KEY: 'x' });
	const restoreKv = stubKvWithCurrentModel('/zai');

	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		replyWithVisionNotSupportedByModel: spy(() => Promise.resolve()),
		extractContextKeys: spy(() =>
			Promise.resolve({
				userKey: 'user:1',
				contextMessage: undefined,
				photos: [{}],
				caption: 'o que tem nessa imagem?',
				quote: undefined,
			})
		),
	};

	await import('../../src/service/TelegramService.ts');
	const fu = await import('../../src/util/FileUtils.ts');
	(fu.FileUtils as any).getTelegramFilesUrl = spy(() => ['https://file/1']);

	const svc = await import('../../src/service/openai/ZaiService.ts');
	const generateTextFromImage = spy(
		(_userKey: string, _quote: string | undefined, _photosUrl: unknown[], _prompt: string) => streamResponse(),
	);
	(svc.default as any).prototype.generateTextFromImage = generateTextFromImage;
	(svc.default as any).prototype.generateText = spy(() => {
		throw new Error('text path should not run for photo messages');
	});

	const TelegramService = (await import('../../src/service/TelegramService.ts')).default;
	await TelegramService.replyTextContent(ctx);

	assertEquals(generateTextFromImage.calls.length, 1);
	assertEquals(
		(generateTextFromImage.calls[0].args[3] as string).trim(),
		'o que tem nessa imagem?',
	);
	assertEquals(ctx.streamReply.calls.length, 1);
	assertEquals(ctx.replyWithVisionNotSupportedByModel.calls.length, 0);

	restoreKv();
});

Deno.test('replyTextContent keeps using message text for text messages', async () => {
	mockDenoEnv({ ZHIPU_API_KEY: 'x' });
	const restoreKv = stubKvWithCurrentModel('/zai');

	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		replyWithVisionNotSupportedByModel: spy(() => Promise.resolve()),
		extractContextKeys: spy(() =>
			Promise.resolve({
				userKey: 'user:1',
				contextMessage: 'me conte uma piada',
				photos: undefined,
				caption: undefined,
				quote: undefined,
			})
		),
	};

	await import('../../src/service/TelegramService.ts');
	const svc = await import('../../src/service/openai/ZaiService.ts');
	const generateText = spy(
		(_userKey: string, _quote: string, _prompt: string) => streamResponse(),
	);
	(svc.default as any).prototype.generateText = generateText;
	(svc.default as any).prototype.generateTextFromImage = spy(() => {
		throw new Error('vision path should not run for text messages');
	});

	const TelegramService = (await import('../../src/service/TelegramService.ts')).default;
	await TelegramService.replyTextContent(ctx);

	assertEquals(generateText.calls.length, 1);
	assertEquals(
		(generateText.calls[0].args[2] as string).trim(),
		'me conte uma piada',
	);
	assertEquals(ctx.streamReply.calls.length, 1);

	restoreKv();
});

Deno.test('replyTextContent sends caption-less photo to vision with default prompt', async () => {
	mockDenoEnv({ ZHIPU_API_KEY: 'x' });
	const restoreKv = stubKvWithCurrentModel('/zai');

	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		replyWithVisionNotSupportedByModel: spy(() => Promise.resolve()),
		extractContextKeys: spy(() =>
			Promise.resolve({
				userKey: 'user:1',
				contextMessage: undefined,
				photos: [{}],
				caption: undefined,
				quote: undefined,
			})
		),
	};

	await import('../../src/service/TelegramService.ts');
	const fu = await import('../../src/util/FileUtils.ts');
	(fu.FileUtils as any).getTelegramFilesUrl = spy(() => ['https://file/1']);

	const svc = await import('../../src/service/openai/ZaiService.ts');
	const generateTextFromImage = spy(
		(_userKey: string, _quote: string | undefined, _photosUrl: unknown[], _prompt: string) => streamResponse(),
	);
	(svc.default as any).prototype.generateTextFromImage = generateTextFromImage;
	(svc.default as any).prototype.generateText = spy(() => {
		throw new Error('text path should not run for photo messages');
	});

	const TelegramService = (await import('../../src/service/TelegramService.ts')).default;
	await TelegramService.replyTextContent(ctx);

	assertEquals(generateTextFromImage.calls.length, 1);
	assertEquals(generateTextFromImage.calls[0].args[3], 'descreva a imagem');
	assertEquals(ctx.replyWithVisionNotSupportedByModel.calls.length, 0);
	assertEquals(ctx.streamReply.calls.length, 1);

	restoreKv();
});

Deno.test('extractContextKeys keeps only the largest photo size, image documents and other files', async () => {
	const { Context } = await import('grammy');
	await import('../../src/prototype/ContextExtensionPrototype.ts');

	const photoCtx: any = {
		from: { id: 42 },
		message: { photo: [{ file_id: 'small' }, { file_id: 'big' }] },
	};
	const photoKeys = await (Context.prototype as any).extractContextKeys.call(photoCtx);
	assertEquals((photoKeys.photos as any[]).map((p: any) => p.file_id), ['big']);

	const imageDocCtx: any = {
		from: { id: 42 },
		message: { document: { file_id: 'doc123', mime_type: 'image/png' } },
	};
	const imageDocKeys = await (Context.prototype as any).extractContextKeys.call(imageDocCtx);
	assertEquals((imageDocKeys.photos as any[])[0].file_id, 'doc123');

	const pdfDocCtx: any = {
		from: { id: 42 },
		message: { document: { file_id: 'doc456', mime_type: 'application/pdf' } },
	};
	const pdfDocKeys = await (Context.prototype as any).extractContextKeys.call(pdfDocCtx);
	assertEquals(pdfDocKeys.photos, undefined);
});

Deno.test('replyTextContent replies helpfully for media it cannot read', async () => {
	mockDenoEnv({ ZHIPU_API_KEY: 'x' });
	const restoreKv = stubKvWithCurrentModel('/zai');

	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		replyWithQuote: spy(() => Promise.resolve()),
		replyWithVisionNotSupportedByModel: spy(() => Promise.resolve()),
		message: { sticker: { file_id: 'stkr1' } },
		extractContextKeys: spy(() =>
			Promise.resolve({
				userKey: 'user:1',
				contextMessage: undefined,
				photos: undefined,
				caption: undefined,
				quote: undefined,
			})
		),
	};

	await import('../../src/service/TelegramService.ts');
	const svc = await import('../../src/service/openai/ZaiService.ts');
	(svc.default as any).prototype.generateText = spy(() => {
		throw new Error('text path should not run for unreadable media');
	});
	(svc.default as any).prototype.generateTextFromImage = spy(() => {
		throw new Error('vision path should not run for unreadable media');
	});

	const TelegramService = (await import('../../src/service/TelegramService.ts')).default;
	await TelegramService.replyTextContent(ctx);

	assertEquals(ctx.replyWithQuote.calls.length, 1);
	assertEquals(
		ctx.replyWithQuote.calls[0].args[0],
		'consigo ler apenas texto, foto ou imagem anexada como arquivo',
	);
	assertEquals(ctx.streamReply.calls.length, 0);

	restoreKv();
});
