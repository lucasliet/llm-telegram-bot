import { assertEquals } from 'asserts';
import ToolService from '../../src/service/ToolService.ts';

/**
 * Creates a spy fetch that returns provided responses sequentially.
 * @param responses - Sequence of Response instances to return.
 * @returns A spy function compatible with global fetch.
 */
function mockFetchSequence(responses: Response[]) {
	let i = 0;
	return (..._args: any[]) => Promise.resolve(responses[i++]);
}

Deno.test('ToolService.schemas exposes tools list', () => {
	const ok = Array.isArray(ToolService.schemas) && ToolService.schemas.length > 0;
	assertEquals(ok, true);
});

Deno.test('ToolService search_searx returns mapped results', async () => {
	const json = {
		results: [
			{ title: 'A', url: 'https://a', category: 'general', content: 'x', time: 't' },
			{ title: 'B', url: 'https://b', category: 'news', content: 'y', time: 't2' },
		],
	};
	const original = globalThis.fetch;
	try {
		globalThis.fetch = mockFetchSequence([new Response(JSON.stringify(json), { status: 200 })]) as any;
		const fn = (ToolService as any).tools.get('search_searx').fn as (args: { query: string; num_results: number }) => Promise<any[]>;
		const res = await fn({ query: 'q', num_results: 1 });
		assertEquals(res.length, 1);
		assertEquals(res[0].title, 'A');
	} finally {
		globalThis.fetch = original;
	}
});

Deno.test('ToolService fetch returns plain text and parses HTML body', async () => {
	const html = '<html><body><div>Hello</div><script>bad()</script></body></html>';
	const original = globalThis.fetch;
	try {
		globalThis.fetch = mockFetchSequence([
			new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
		]) as any;
		const fn = (ToolService as any).tools.get('fetch').fn as (args: { url: string }) => Promise<string>;
		const res = await fn({ url: 'https://example.com' });
		assertEquals(res.includes('Hello'), true);
	} finally {
		globalThis.fetch = original;
	}
});

Deno.test('ToolService copilot_usage throws without token', async () => {
	const original = Deno.env.get;
	try {
		Deno.env.get = (_k: string) => undefined as any;
		const fn = (ToolService as any).tools.get('copilot_usage').fn as (args: Record<string, never>) => Promise<any>;
		let threw = false;
		try {
			await fn({} as never);
		} catch {
			threw = true;
		}
		assertEquals(threw, true);
	} finally {
		Deno.env.get = original;
	}
});


Deno.test('ToolService transcript_yt parses captions and returns segments', async () => {
	const watchHtml = '{"INNERTUBE_API_KEY":"k"}';
	const innertube = {
		playabilityStatus: { status: 'OK' },
		captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: 'en', baseUrl: 'https://c' }], translationLanguages: [{ languageCode: 'pt' }] } },
	};
	const xml = '<transcript><text start="0" dur="1.0">Hello</text></transcript>';
	const original = globalThis.fetch;
	try {
		globalThis.fetch = mockFetchSequence([
			new Response(watchHtml, { status: 200 }),
			new Response(JSON.stringify(innertube), { status: 200 }),
			new Response(xml, { status: 200 }),
		]) as any;
		const fn = (ToolService as any).tools.get('transcript_yt').fn as (args: { videoUrl: string; preferredLanguages?: string[] }) => Promise<any>;
		const segments = await fn({ videoUrl: 'https://youtu.be/aaaaaaaaaaa' });
		assertEquals(Array.isArray(segments) && segments.length > 0, true);
	} finally {
		globalThis.fetch = original;
	}
});

Deno.test('ToolService transcript_yt returns null for invalid URL', async () => {
	const fn = (ToolService as any).tools.get('transcript_yt').fn as (args: { videoUrl: string; preferredLanguages?: string[] }) => Promise<any>;
	const res = await fn({ videoUrl: 'https://example.com' });
	assertEquals(res, null);
});

Deno.test('ToolService transcript_yt accepts live URL format', async () => {
	const watchHtml = '{"INNERTUBE_API_KEY":"k"}';
	const innertube = {
		playabilityStatus: { status: 'OK' },
		captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: 'en', baseUrl: 'https://c' }], translationLanguages: [{ languageCode: 'pt' }] } },
	};
	const xml = '<transcript><text start="0" dur="1.0">Hello</text></transcript>';
	const original = globalThis.fetch;
	try {
		globalThis.fetch = mockFetchSequence([
			new Response(watchHtml, { status: 200 }),
			new Response(JSON.stringify(innertube), { status: 200 }),
			new Response(xml, { status: 200 }),
		]) as any;
		const fn = (ToolService as any).tools.get('transcript_yt').fn as (args: { videoUrl: string; preferredLanguages?: string[] }) => Promise<any>;
		const segments = await fn({ videoUrl: 'https://www.youtube.com/live/aaaaaaaaaaa' });
		assertEquals(Array.isArray(segments) && segments.length > 0, true);
	} finally {
		globalThis.fetch = original;
	}
});

Deno.test('ToolService transcript_yt honors preferredLanguages', async () => {
	const watchHtml = '{"INNERTUBE_API_KEY":"k"}';
	const innertube = {
		playabilityStatus: { status: 'OK' },
		captions: {
			playerCaptionsTracklistRenderer: {
				captionTracks: [
					{ languageCode: 'en', baseUrl: 'https://c-en' },
					{ languageCode: 'pt-BR', baseUrl: 'https://c-pt' },
				],
				translationLanguages: [{ languageCode: 'pt' }, { languageCode: 'en' }],
			},
		},
	};
	const xml = '<transcript><text start="0" dur="1.0">Oi</text></transcript>';
	const original = globalThis.fetch;
	try {
		globalThis.fetch = mockFetchSequence([
			new Response(watchHtml, { status: 200 }),
			new Response(JSON.stringify(innertube), { status: 200 }),
			new Response(xml, { status: 200 }),
		]) as any;
		const fn = (ToolService as any).tools.get('transcript_yt').fn as (args: { videoUrl: string; preferredLanguages?: string[] }) => Promise<any>;
		const res = await fn({ videoUrl: 'https://youtu.be/aaaaaaaaaaa', preferredLanguages: ['pt'] });
		assertEquals(Array.isArray(res) && res.length > 0, true);
	} finally {
		globalThis.fetch = original;
	}
});

Deno.test('ToolService copilot_usage returns JSON on success', async () => {
	const fn = (ToolService as any).tools.get('copilot_usage').fn as (args: Record<string, never>) => Promise<any>;
	const originalGet = Deno.env.get;
	const originalFetch = globalThis.fetch;
	try {
		Deno.env.get = (k: string) => (k === 'COPILOT_TOKEN' ? 'tok' : originalGet(k)) as any;
		globalThis.fetch = mockFetchSequence([new Response(JSON.stringify({ ok: true }), { status: 200 })]) as any;
		const out = await fn({} as never);
		assertEquals(out.ok, true);
	} finally {
		Deno.env.get = originalGet;
		globalThis.fetch = originalFetch;
	}
});
