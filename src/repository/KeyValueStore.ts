export interface KeyValueSetOptions {
	expiresAt?: Date;
}

/**
 * Runtime-agnostic key-value storage used by the repositories.
 */
export interface KeyValueStore {
	get<T>(key: string): Promise<T | null>;
	set<T>(key: string, value: T, options?: KeyValueSetOptions): Promise<void>;
	delete(key: string): Promise<void>;
}

/**
 * Subset of the Cloudflare Workers `KVNamespace` binding used by this project.
 */
export interface KVNamespaceBinding {
	get(key: string, type: 'json'): Promise<unknown>;
	put(key: string, value: string, options?: { expiration?: number }): Promise<void>;
	delete(key: string): Promise<void>;
}

interface InMemoryEntry {
	value: unknown;
	expiresAt?: number;
}

/**
 * Process-local store used by local development and tests.
 * State lives only as long as the current process/isolate.
 */
export class InMemoryKeyValueStore implements KeyValueStore {
	private readonly entries = new Map<string, InMemoryEntry>();

	/**
	 * Read a value, dropping it when its expiration has passed.
	 *
	 * @param key - Storage key.
	 * @returns The stored value, or null when missing or expired.
	 */
	get<T>(key: string): Promise<T | null> {
		const entry = this.entries.get(key);
		if (!entry) return Promise.resolve(null);
		if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
			this.entries.delete(key);
			return Promise.resolve(null);
		}
		return Promise.resolve(structuredClone(entry.value) as T);
	}

	/**
	 * Store a defensive copy of the value.
	 *
	 * @param key - Storage key.
	 * @param value - Value to store.
	 * @param options - Optional absolute expiration.
	 */
	set<T>(key: string, value: T, options?: KeyValueSetOptions): Promise<void> {
		this.entries.set(key, { value: structuredClone(value), expiresAt: options?.expiresAt?.getTime() });
		return Promise.resolve();
	}

	/**
	 * Remove a key if present.
	 *
	 * @param key - Storage key.
	 */
	delete(key: string): Promise<void> {
		this.entries.delete(key);
		return Promise.resolve();
	}
}

/**
 * Store backed by a Cloudflare Workers KV namespace, serializing values as JSON.
 */
export class CloudflareKeyValueStore implements KeyValueStore {
	constructor(private readonly namespace: KVNamespaceBinding) {}

	/**
	 * Read and parse a JSON value from KV.
	 *
	 * @param key - Storage key.
	 * @returns The stored value, or null when missing.
	 */
	async get<T>(key: string): Promise<T | null> {
		return (await this.namespace.get(key, 'json') as T | null) ?? null;
	}

	/**
	 * Serialize and write a value to KV.
	 *
	 * @param key - Storage key.
	 * @param value - Value to store.
	 * @param options - Optional absolute expiration, converted to epoch seconds.
	 */
	set<T>(key: string, value: T, options?: KeyValueSetOptions): Promise<void> {
		const expiration = options?.expiresAt ? Math.floor(options.expiresAt.getTime() / 1000) : undefined;
		return this.namespace.put(key, JSON.stringify(value), expiration ? { expiration } : undefined);
	}

	/**
	 * Remove a key from KV.
	 *
	 * @param key - Storage key.
	 */
	delete(key: string): Promise<void> {
		return this.namespace.delete(key);
	}
}

let activeStore: KeyValueStore = new InMemoryKeyValueStore();

/**
 * Get the store currently used by the repositories.
 *
 * @returns The active key-value store.
 */
export function getKeyValueStore(): KeyValueStore {
	return activeStore;
}

/**
 * Replace the store used by the repositories (e.g. with the Workers KV binding).
 *
 * @param store - Store to activate.
 */
export function setKeyValueStore(store: KeyValueStore): void {
	activeStore = store;
}
