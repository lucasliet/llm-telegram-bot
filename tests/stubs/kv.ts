export function setupKvStub() {
	const originalOpenKv = Deno.openKv;
	const kv = {
		get: () => Promise.resolve({ value: undefined }),
		set: () => Promise.resolve({ ok: true }),
		delete: () => Promise.resolve({ ok: true }),
		close: () => Promise.resolve(),
	};
	Deno.openKv = () => Promise.resolve(kv as any);
	return () => {
		Deno.openKv = originalOpenKv;
	};
}
