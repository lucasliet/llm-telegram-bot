import { setupKvStub } from '../stubs/kv.ts';

Deno.test('CodexHandler loads for coverage', async () => {
	setupKvStub();
	const mod = await import('@/handlers/CodexHandler.ts');
	if (typeof mod.handleCodex !== 'function') throw new Error('handleCodex not function');
});
