import { assertEquals } from 'asserts';
import { spy } from 'mock';

Deno.test('ToolService transcript_yt returns null for invalid URL', async () => {
	const svc = await import('../../src/service/ToolService.ts');
	const fn = (svc.default as any).tools.get('transcript_yt').fn as (args: { videoUrl: string; preferredLanguages?: string[] }) => Promise<any>;
	const res = await fn({ videoUrl: 'https://example.com' });
	assertEquals(res, null);
});

Deno.test('ToolService transcript_yt honors preferredLanguages', async () => {
	const svc = await import('../../src/service/ToolService.ts');
	const html = 'ytInitialPlayerResponse = ' + JSON.stringify({
		captions: {
			playerCaptionsTracklistRenderer: {
				captionTracks: [
					{ languageCode: 'en', baseUrl: 'https://c-en' },
					{ languageCode: 'pt-BR', baseUrl: 'https://c-pt' },
				],
			},
		},
	}) + ';';
	const xml = '<timedtext><body><p t="0" d="1000">Oi</p></body></timedtext>';
	const original = globalThis.fetch;
	try {
		globalThis.fetch = spy(() => {
			const i = (globalThis.fetch as any).calls.length;
			return Promise.resolve(i === 0 ? new Response(html, { status: 200 }) : new Response(xml, { status: 200 }));
		}) as any;
		const fn = (svc.default as any).tools.get('transcript_yt').fn as (args: { videoUrl: string; preferredLanguages?: string[] }) => Promise<any>;
		const res = await fn({ videoUrl: 'https://youtu.be/aaaaaaaaaaa', preferredLanguages: ['pt'] });
		assertEquals(Array.isArray(res) && res.length > 0, true);
	} finally {
		globalThis.fetch = original;
	}
});

Deno.test('ToolService copilot_usage returns JSON on success', async () => {
	const svc = await import('../../src/service/ToolService.ts');
	const fn = (svc.default as any).tools.get('copilot_usage').fn as () => Promise<any>;
	const originalGet = Deno.env.get;
	const originalFetch = globalThis.fetch;
	try {
		Deno.env.get = (k: string) => (k === 'COPILOT_TOKEN' ? 'tok' : originalGet(k)) as any;
		globalThis.fetch = spy(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))) as any;
		const out = await fn();
		assertEquals(out.ok, true);
	} finally {
		Deno.env.get = originalGet;
		globalThis.fetch = originalFetch;
	}
});
