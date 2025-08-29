import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { mockDenoEnv } from '../test_helpers.ts';
Deno.test('OpenAIHandler routes to GithubService on gpt command', async () => {
	const originalOpenKv = Deno.openKv;
	mockDenoEnv({ OPENAI_API_KEY: 'x', GITHUB_TOKEN: 'y' });
	Deno.openKv = () =>
		Promise.resolve(
			{
				get: () => Promise.resolve({ value: [] }),
				set: () => Promise.resolve({ ok: true }),
				delete: () => Promise.resolve({ ok: true }),
				close: () => Promise.resolve(),
			} as any,
		);
	try {
		const ctx: any = {
			replyWithMediaGroup: spy(() => Promise.resolve()),
			streamReply: spy(() => Promise.resolve()),
			extractContextKeys: spy(() =>
				Promise.resolve({ userKey: 'user:1', contextMessage: 'gpt: hello', photos: undefined, caption: undefined, quote: undefined })
			),
			message: { message_id: 1 },
		};
		await import('../../src/service/TelegramService.ts');
		const mod = await import('../../src/handlers/OpenAIHandler.ts');
		const gh = await import('../../src/service/openai/GithubService.ts');
		(gh.default as any).prototype.generateText = spy(() =>
			Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s })
		);
		await mod.handleOpenAI(ctx as any);
		assertEquals(ctx.streamReply.calls.length, 1);
	} finally {
		Deno.openKv = originalOpenKv;
	}
});

Deno.test('OpenAIHandler handles gptimage path', async () => {
	const originalOpenKv = Deno.openKv;
	mockDenoEnv({ OPENAI_API_KEY: 'x', GITHUB_TOKEN: 'y' });
	Deno.openKv = () =>
		Promise.resolve(
			{
				get: () => Promise.resolve({ value: [] }),
				set: () => Promise.resolve({ ok: true }),
				delete: () => Promise.resolve({ ok: true }),
				close: () => Promise.resolve(),
			} as any,
		);
	try {
		const ctx: any = {
			replyWithMediaGroup: spy(() => Promise.resolve()),
			streamReply: spy(() => Promise.resolve()),
			extractContextKeys: spy(() =>
				Promise.resolve({ userKey: 'user:1', contextMessage: 'gptImage: draw', photos: undefined, caption: undefined, quote: undefined })
			),
			message: { message_id: 2 },
		};
		await import('../../src/service/TelegramService.ts');
		const mod = await import('../../src/handlers/OpenAIHandler.ts');
		const svc = await import('../../src/service/openai/OpenAIService.ts');
		(svc.default as any).prototype.generateImage = spy(() => Promise.resolve(['https://img/1']));
		await mod.handleOpenAI(ctx as any);
		assertEquals(ctx.replyWithMediaGroup.calls.length, 1);
	} finally {
		Deno.openKv = originalOpenKv;
	}
});
