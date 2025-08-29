import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { mockDenoEnv } from '../test_helpers.ts';

Deno.test('TelegramService.getUsage replies formatted for admin', async () => {
	mockDenoEnv({ BOT_TOKEN: 't', ADMIN_USER_IDS: '12345|678', COPILOT_TOKEN: 'ct' });
	const { setupKvStub } = await import('../stubs/kv.ts');
	setupKvStub();
	const originalFetch = globalThis.fetch;
	try {
		globalThis.fetch = spy(() => Promise.resolve(new Response(JSON.stringify({
			copilot_plan: 'pro',
			access_type_sku: 'sku_value',
			chat_enabled: true,
			assigned_date: new Date().toISOString(),
			quota_reset_date: new Date().toISOString(),
			quota_snapshots: {
				chat: { entitlement: 100, remaining: 50, overage_permitted: false, overage_count: 0 },
				completions: { entitlement: 100, remaining: 100, overage_permitted: false, overage_count: 0 },
				premium_interactions: { percent_remaining: 80, overage_permitted: true, overage_count: 1 },
			},
		}), { status: 200 }))) as any;
		const mod = await import('../../src/service/TelegramService.ts');
		const ctx: any = {
			reply: spy(() => Promise.resolve()),
			extractContextKeys: spy(() => Promise.resolve({ userId: 12345 })),
		};
		await (mod.default as any).getUsage(ctx);
		assertEquals(ctx.reply.calls.length, 1);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
