import { assertEquals } from '../deps.ts';
import { MockKvStore } from '../test_helpers.ts';

Deno.test('SessionRepository', async () => {
        const mockKv = new MockKvStore();
        const originalOpenKv = Deno.openKv;
        Deno.openKv = () => Promise.resolve(mockKv as unknown as Deno.Kv);

        const { createSession, getSession } = await import('../../src/repository/SessionRepository.ts');
        const session = { user: { name: 'a', email: 'b', image: 'c' }, expires: new Date().toISOString() };
        await createSession(session);
        const stored = await getSession();
        assertEquals(stored?.user.name, 'a');

        Deno.openKv = originalOpenKv;
});
