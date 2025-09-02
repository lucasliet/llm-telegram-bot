import { assertEquals } from 'asserts';
import { spy } from 'mock';

Deno.test('ArtaService.generateImage completes after status DONE', async () => {
	const svc = await import('../../src/service/ArtaService.ts');
	const originalFetch = globalThis.fetch;
	try {
		const tokenRes = new Response(JSON.stringify({ idToken: 't' }), { status: 200 });
		const startRes = new Response(JSON.stringify({ record_id: 'rid', status: 'PENDING' }), { status: 200 });
		const doneRes = new Response(JSON.stringify({ status: 'DONE', response: [{ url: 'https://img/ok.png' }] }), { status: 200 });
		globalThis.fetch = spy(() => {
			const c = (globalThis.fetch as any).calls?.length || 0;
			return Promise.resolve([tokenRes, startRes, doneRes][c] || doneRes);
		}) as any;
		const url = await (svc.default as any).generateImage('a cat');
		assertEquals(url, 'https://img/ok.png');
	} finally {
		globalThis.fetch = originalFetch;
	}
});
