import { assertEquals } from 'asserts';
import { setupKvStub } from '../stubs/kv.ts';

Deno.test('Instantiate OpenAI-related service classes constructors', async () => {
	setupKvStub();
	const env = Deno.env.get;
	Deno.env.get = (k: string) =>
		({
			GEMINI_API_KEY: 'g',
			OPENWEBUI_API_KEY: 'o',
			OPENROUTER_API_KEY: 'r',
			PERPLEXITY_API_KEY: 'p',
			COPILOT_TOKEN: 'c',
		}[k] || env(k)) as any;
	try {
		const Gemini = (await import('../../src/service/openai/GeminiService.ts')).default;
		const OpenWebUI = (await import('../../src/service/openai/OpenWebUIService.ts')).default;
		const Openrouter = (await import('../../src/service/openai/OpenrouterService.ts')).default;
		const Perplexity = (await import('../../src/service/openai/PerplexityService.ts')).default;
		const GithubCopilot = (await import('../../src/service/openai/GithubCopilotService.ts')).default;

		const g = new (Gemini as any)();
		const w = new (OpenWebUI as any)();
		const r = new (Openrouter as any)();
		const p = new (Perplexity as any)('/perplexity');
		const c = new (GithubCopilot as any)();

		assertEquals(typeof g, 'object');
		assertEquals(typeof w, 'object');
		assertEquals(typeof r, 'object');
		assertEquals(typeof p, 'object');
		assertEquals(typeof c, 'object');
	} finally {
		Deno.env.get = env;
	}
});
