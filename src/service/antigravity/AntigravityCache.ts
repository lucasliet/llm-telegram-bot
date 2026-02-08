import crypto from 'node:crypto';

interface CachedSignature {
	text: string;
	signature: string;
	timestamp: number;
}

class SignatureStore {
	private cache: Map<string, CachedSignature> = new Map();
	private readonly TTL_MS = 3600000;
	private readonly MAX_ENTRIES_PER_SESSION = 1000;

	private buildKey(sessionId: string, text: string): string {
		const hash = crypto.createHash('sha256').update(`${sessionId}:${text}`).digest('hex');
		return hash;
	}

	set(sessionId: string, text: string, signature: string): void {
		if (!text || !signature) return;

		const key = this.buildKey(sessionId, text);
		const sessionPrefix = `${sessionId}:`;

		const sessionEntries = Array.from(this.cache.entries()).filter(([k]) => k.startsWith(sessionPrefix));
		if (sessionEntries.length >= this.MAX_ENTRIES_PER_SESSION) {
			sessionEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
			for (let i = 0; i < sessionEntries.length / 2; i++) {
				this.cache.delete(sessionEntries[i][0]);
			}
		}

		this.cache.set(key, { text, signature, timestamp: Date.now() });
		this.cleanup();
	}

	get(sessionId: string, text: string): string | undefined {
		const key = this.buildKey(sessionId, text);
		const cached = this.cache.get(key);
		if (!cached) return undefined;

		if (Date.now() - cached.timestamp > this.TTL_MS) {
			this.cache.delete(key);
			return undefined;
		}

		return cached.signature;
	}

	has(sessionId: string): boolean {
		const sessionPrefix = `${sessionId}:`;
		for (const key of this.cache.keys()) {
			if (key.startsWith(sessionPrefix)) {
				return true;
			}
		}
		return false;
	}

	cleanup(): void {
		const now = Date.now();
		const expiredKeys: string[] = [];

		for (const [key, value] of this.cache.entries()) {
			if (now - value.timestamp > this.TTL_MS) {
				expiredKeys.push(key);
			}
		}

		for (const key of expiredKeys) {
			this.cache.delete(key);
		}
	}

	clear(): void {
		this.cache.clear();
	}

	getStats(): { totalEntries: number; sessions: number } {
		const sessions = new Set<string>();
		for (const key of this.cache.keys()) {
			const sessionId = key.split(':')[0];
			sessions.add(sessionId);
		}
		return {
			totalEntries: this.cache.size,
			sessions: sessions.size,
		};
	}
}

export const defaultSignatureStore = new SignatureStore();

export function cacheSignature(sessionId: string, text: string, signature: string): void {
	defaultSignatureStore.set(sessionId, text, signature);
}

export function getCachedSignature(sessionId: string, text: string): string | undefined {
	return defaultSignatureStore.get(sessionId, text);
}
