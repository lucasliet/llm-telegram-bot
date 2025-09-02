import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { mockDenoEnv } from '../test_helpers.ts';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('PerplexityHandler maps search alias and streams', async () => {
	mockDenoEnv({ PERPLEXITY_API_KEY: 'x' });
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		extractContextKeys: spy(() =>
			Promise.resolve({ userKey: 'user:1', contextMessage: 'search: web q', photos: undefined, caption: undefined, quote: undefined })
		),
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/PerplexityHandler.ts');
	const svc = await import('../../src/service/openai/PerplexityService.ts');
	(svc.default as any).prototype.generateText = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s })
	);
	await mod.handlePerplexity(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	restore();
});
