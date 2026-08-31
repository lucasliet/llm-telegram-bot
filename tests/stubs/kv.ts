export function setupKvStub() {
	const originalDescriptor = Object.getOwnPropertyDescriptor(Deno, 'openKv') ??
		Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Deno), 'openKv');
	const kv = {
		get: () => Promise.resolve({ value: undefined }),
		set: () => Promise.resolve({ ok: true }),
		delete: () => Promise.resolve({ ok: true }),
		close: () => Promise.resolve(),
	};
	Object.defineProperty(Deno, 'openKv', {
		value: () => Promise.resolve(kv as unknown as Deno.Kv),
		writable: true,
		configurable: true,
	});
	return () => {
		if (originalDescriptor) {
			Object.defineProperty(Deno, 'openKv', originalDescriptor);
		} else {
			delete (Deno as unknown as { openKv?: unknown }).openKv;
		}
	};
}

/**
 * Assigns a Deno.openKv stub safely; plain assignment throws on Deno 2,
 * where openKv is a getter-only inherited namespace member.
 */
export function assignOpenKv(value: unknown): void {
	Object.defineProperty(Deno, 'openKv', { value, writable: true, configurable: true });
}
