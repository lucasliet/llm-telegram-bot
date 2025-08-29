import { assertEquals, assertRejects } from 'https://deno.land/std@0.214.0/assert/mod.ts';
import { afterEach, beforeEach, describe, it } from 'https://deno.land/std@0.214.0/testing/bdd.ts';
import { assertSpyCalls, Spy, spy } from 'https://deno.land/std@0.214.0/testing/mock.ts';
let BlackboxaiService: any;

describe('BlackboxaiService', () => {
	let mockFetch: Spy;
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		mockFetch = spy(() =>
			Promise.resolve({
				ok: true,
				text: () => Promise.resolve('![Generated image](https://example.com/image.png)'),
				json: () =>
					Promise.resolve({
						choices: [{ message: { content: 'Generated text response' } }],
					}),
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode('Generated text response'));
						controller.close();
					},
				}),
			})
		);

		globalThis.fetch = mockFetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	describe('generateText', () => {
		it('should generate text successfully', async () => {
			const originalOpenKv = Deno.openKv;
			Deno.openKv = () =>
				Promise.resolve(
					{
						get: () => Promise.resolve({ value: undefined }),
						set: () => Promise.resolve({ ok: true }),
						delete: () => Promise.resolve({ ok: true }),
						close: () => Promise.resolve(),
					} as any,
				);
			BlackboxaiService = (await import('../../src/service/BlackboxaiService.ts')).default;
			const response = await BlackboxaiService.generateText(
				'test-user-key',
				'test quote',
				'Hello',
				'gpt-3.5-turbo',
			);

			assertEquals(typeof response.reader.read, 'function');
			assertEquals(typeof response.onComplete, 'function');

			assertSpyCalls(mockFetch, 1);
			const [url, options] = mockFetch.calls[0].args;
			assertEquals(url, 'https://www.blackbox.ai/api/chat');
			assertEquals(options.method, 'POST');

			const body = JSON.parse(options.body);
			assertEquals(body.messages[body.messages.length - 1].content, 'quote: "test quote"\n\nHello');
			Deno.openKv = originalOpenKv;
		});

		it('should handle API errors', async () => {
			const originalOpenKv = Deno.openKv;
			Deno.openKv = () =>
				Promise.resolve(
					{
						get: () => Promise.resolve({ value: undefined }),
						set: () => Promise.resolve({ ok: true }),
						delete: () => Promise.resolve({ ok: true }),
						close: () => Promise.resolve(),
					} as any,
				);
			BlackboxaiService = (await import('../../src/service/BlackboxaiService.ts')).default;
			globalThis.fetch = spy(() =>
				Promise.resolve({
					ok: false,
					statusText: 'Unauthorized',
				})
			);

			await assertRejects(
				() => BlackboxaiService.generateText('test-user-key', '', 'Hello'),
				Error,
				'Failed to generate text: Unauthorized',
			);
			Deno.openKv = originalOpenKv;
		});
	});

	describe('generateImage', () => {
		it('should generate image successfully', async () => {
			const originalOpenKv = Deno.openKv;
			Deno.openKv = () =>
				Promise.resolve(
					{
						get: () => Promise.resolve({ value: undefined }),
						set: () => Promise.resolve({ ok: true }),
						delete: () => Promise.resolve({ ok: true }),
						close: () => Promise.resolve(),
					} as any,
				);
			BlackboxaiService = (await import('../../src/service/BlackboxaiService.ts')).default;
			const imageUrl = await BlackboxaiService.generateImage('A test prompt');

			assertEquals(imageUrl, 'https://example.com/image.png');
			assertSpyCalls(mockFetch, 1);

			const [url, options] = mockFetch.calls[0].args;
			assertEquals(url, 'https://www.blackbox.ai/api/chat');
			assertEquals(options.method, 'POST');

			const body = JSON.parse(options.body);
			assertEquals(body.messages[0].content, 'A test prompt');
			Deno.openKv = originalOpenKv;
		});

		it('should handle API errors', async () => {
			const originalOpenKv = Deno.openKv;
			Deno.openKv = () =>
				Promise.resolve(
					{
						get: () => Promise.resolve({ value: undefined }),
						set: () => Promise.resolve({ ok: true }),
						delete: () => Promise.resolve({ ok: true }),
						close: () => Promise.resolve(),
					} as any,
				);
			BlackboxaiService = (await import('../../src/service/BlackboxaiService.ts')).default;
			globalThis.fetch = spy(() =>
				Promise.resolve({
					ok: false,
					statusText: 'Bad Request',
				})
			);

			await assertRejects(
				() => BlackboxaiService.generateImage('A test prompt'),
				Error,
				'Failed to generate image: Bad Request',
			);
			Deno.openKv = originalOpenKv;
		});
	});
});
