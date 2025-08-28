import { assertEquals, assertRejects } from 'asserts';
import { setUserKey } from '../../src/utils/ExecutionContext.ts';

Deno.test('memory tool', async () => {
	const originalOpenKv = Deno.openKv;
	const store = new Map<string, string>();
	const mockKv = {
		get: (key: string[]) => Promise.resolve({ value: store.get(key.join('-')) }),
		set: (key: string[], value: string) => {
			store.set(key.join('-'), value);
			return Promise.resolve();
		},
		delete: (key: string[]) => {
			store.delete(key.join('-'));
			return Promise.resolve();
		},
		close: () => Promise.resolve(),
	} as unknown as Deno.Kv;
	Deno.openKv = () => Promise.resolve(mockKv);
	const ToolService = (await import('../../src/service/ToolService.ts')).default;
	const tool = ToolService.tools.get('memory')?.fn as Function;
	setUserKey('user:1');
	await tool({ operation: 'remember', data: { debt: 500 } });
	const recall = await tool({ operation: 'recall' });
	assertEquals(recall, { debt: 500 });
	const newValue = await tool({ operation: 'adjust', field: 'debt', amount: -100 });
	assertEquals(newValue, 400);
	const adjusted = await tool({ operation: 'recall' });
	assertEquals(adjusted, { debt: 400 });
        await tool({ operation: 'clear' });
        const cleared = await tool({ operation: 'recall' });
        assertEquals(cleared, {});
        await assertRejects(() => tool({ operation: 'remember', data: 1 as unknown as Record<string, unknown> }));
        Deno.openKv = originalOpenKv;
});
