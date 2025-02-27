import { Context } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';
import { Spy, spy } from 'mock';
import { assertEquals } from 'asserts';

export function assertSpyCalls(spy: Spy, expectedCalls: number): void {
	assertEquals(
		spy.calls.length,
		expectedCalls,
		`Expected spy to be called ${expectedCalls} time(s) but was called ${spy.calls.length} time(s)`,
	);
}

export interface MockContext {
	reply: Spy;
	extractContextKeys: Spy;
	replyOnLongAnswer: Spy;
	from?: {
		id: number;
	};
	message?: {
		text?: string;
		message_id?: number;
		from?: {
			id: number;
		};
	};
	msg?: {
		message_id?: number;
		from?: {
			id: number;
		};
	};
	callbackQuery?: {
		data?: string;
	};
}

export function createMockContext(options: {
	userId?: number;
	userKey?: string;
	message?: string;
	messageId?: number;
	callbackData?: string;
} = {}): MockContext {
	const userId = options.userId ?? 12345;
	const userKey = options.userKey ?? `user:${userId}`;
	const message = options.message ?? 'Test message';
	const messageId = options.messageId ?? 1;

	const mockContext = {
		reply: spy(),
		extractContextKeys: spy(() =>
			Promise.resolve({
				userId,
				userKey,
				contextMessage: message,
			})
		),
		replyOnLongAnswer: spy(() => 123),
		from: {
			id: userId,
		},
		message: {
			text: message,
			message_id: messageId,
			from: {
				id: userId,
			},
		},
		msg: {
			message_id: messageId,
			from: {
				id: userId,
			},
		},
	} as MockContext;

	if (options.callbackData) {
		mockContext.callbackQuery = {
			data: options.callbackData,
		};
	}

	return mockContext;
}

export class MockKvStore {
	private store = new Map<string, unknown>();

	async get(key: unknown): Promise<{ value: unknown }> {
		const keyStr = this.stringifyKey(key);
		return { value: this.store.get(keyStr) };
	}

	async set(key: unknown, value: unknown, options = {}): Promise<{ ok: true }> {
		const keyStr = this.stringifyKey(key);
		this.store.set(keyStr, value);
		return { ok: true };
	}

	async delete(key: unknown): Promise<{ ok: true }> {
		const keyStr = this.stringifyKey(key);
		this.store.delete(keyStr);
		return { ok: true };
	}

	async close(): Promise<void> {
		this.store.clear();
	}

	private stringifyKey(key: unknown): string {
		if (Array.isArray(key)) {
			return JSON.stringify(key);
		}
		return String(key);
	}
}

export function mockDenoEnv(envVars: Record<string, string>): void {
	const originalGet = Deno.env.get;
	Deno.env.get = (key: string) => envVars[key] || originalGet(key);
}
