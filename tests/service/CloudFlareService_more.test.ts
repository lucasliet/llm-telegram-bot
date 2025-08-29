import { assertEquals } from 'asserts';
import { spy } from 'mock';
import { mockDenoEnv } from '../test_helpers.ts';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('CloudFlareService.generateImage returns Uint8Array', async () => {
	setupKvStub();
	mockDenoEnv({ CLOUDFLARE_API_KEY: 'k', CLOUDFLARE_ACCOUNT_ID: 'acc' });
	const svc = await import('../../src/service/CloudFlareService.ts');
	const originalFetch = globalThis.fetch;
	try {
		const pngBase64 = btoa('png');
		globalThis.fetch = spy(() => Promise.resolve(new Response(JSON.stringify({ result: { image: pngBase64 } }), { status: 200 }))) as any;
		const bytes = await (svc.default as any).generateImage('prompt');
		assertEquals(bytes instanceof Uint8Array, true);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

Deno.test('CloudFlareService.transcribeAudio returns text', async () => {
	setupKvStub();
	mockDenoEnv({ CLOUDFLARE_API_KEY: 'k', CLOUDFLARE_ACCOUNT_ID: 'acc' });
	const svc = await import('../../src/service/CloudFlareService.ts');
	const originalFetch = globalThis.fetch;
	try {
		globalThis.fetch = spy(() => Promise.resolve(new Response(JSON.stringify({ result: { text: 'hello' } }), { status: 200 }))) as any;
		const text = await (svc.default as any).transcribeAudio(Promise.resolve(new Uint8Array([1, 2])));
		assertEquals(text, 'hello');
	} finally {
		globalThis.fetch = originalFetch;
	}
});

Deno.test('CloudFlareService.transcribeFile returns markdown text', async () => {
	setupKvStub();
	mockDenoEnv({ CLOUDFLARE_API_KEY: 'k', CLOUDFLARE_ACCOUNT_ID: 'acc' });
	const svc = await import('../../src/service/CloudFlareService.ts');
	const originalFetch = globalThis.fetch;
	try {
		globalThis.fetch = spy(() => Promise.resolve(new Response(JSON.stringify({ result: { data: '# md' } }), { status: 200 }))) as any;
		const out = await (svc.default as any).transcribeFile([{ content: Promise.resolve(new Uint8Array([1])), fileName: 'a.bin' }]);
		assertEquals(out, '# md');
	} finally {
		globalThis.fetch = originalFetch;
	}
});

Deno.test('CloudFlareService.generateTextFromImage returns description', async () => {
	setupKvStub();
	mockDenoEnv({ CLOUDFLARE_API_KEY: 'k', CLOUDFLARE_ACCOUNT_ID: 'acc' });
	const svc = await import('../../src/service/CloudFlareService.ts');
	const originalFetch = globalThis.fetch;
	try {
		const responses = [
			new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 }),
			new Response(JSON.stringify({ result: { description: 'desc' } }), { status: 200 }),
		];
		globalThis.fetch = spy(() => {
			const i = (globalThis.fetch as any).calls.length;
			return Promise.resolve(responses[i] || responses[1]);
		}) as any;
		const desc = await (svc.default as any).generateTextFromImage('user:1', '', Promise.resolve('https://file'), 'p');
		assertEquals(desc, 'desc');
	} finally {
		globalThis.fetch = originalFetch;
	}
});

