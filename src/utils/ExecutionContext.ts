import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage<{ userKey: string }>();

/**
 * Sets the user key for the current execution context.
 * @param userKey User identifier
 */
export function setUserKey(userKey: string): void {
	store.enterWith({ userKey });
}

/**
 * Retrieves the user key from the current execution context.
 * @returns The user key or undefined
 */
export function getUserKey(): string | undefined {
	return store.getStore()?.userKey;
}
