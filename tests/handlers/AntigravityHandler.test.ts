import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { mockDenoEnv } from '../test_helpers.ts';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('AntigravityHandler streams text path', async () => {
	mockDenoEnv({ ANTIGRAVITY_REFRESH_TOKEN: 'test-token', ANTIGRAVITY_PROJECT_ID: 'test-project', ADMIN_USER_IDS: '123,456' });
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		extractContextKeys: spy(() =>
			Promise.resolve({ userKey: 'user:1', contextMessage: 'antigravity: hi', photos: undefined, caption: undefined, quote: undefined })
		),
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/AntigravityHandler.ts');
	const svc = await import('../../src/service/openai/AntigravityService.ts');
	(svc.default as any).prototype.generateText = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s })
	);
	await mod.handleAntigravity(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	restore();
});

Deno.test('AntigravityHandler routes anticlaude command', async () => {
	mockDenoEnv({ ANTIGRAVITY_REFRESH_TOKEN: 'test-token', ANTIGRAVITY_PROJECT_ID: 'test-project', ADMIN_USER_IDS: '123,456' });
	const restore = setupKvStub();
	const ctx: any = {
		streamReply: spy(() => Promise.resolve()),
		extractContextKeys: spy(() =>
			Promise.resolve({ userKey: 'user:1', contextMessage: 'anticlaude: hello', photos: undefined, caption: undefined, quote: undefined })
		),
	};
	await import('../../src/service/TelegramService.ts');
	const mod = await import('../../src/handlers/AntigravityHandler.ts');
	const svc = await import('../../src/service/openai/AntigravityService.ts');
	(svc.default as any).prototype.generateText = spy(() =>
		Promise.resolve({ reader: new ReadableStream().getReader(), onComplete: () => Promise.resolve(), responseMap: (s: string) => s })
	);
	await mod.handleAntigravity(ctx);
	assertEquals(ctx.streamReply.calls.length, 1);
	restore();
});
