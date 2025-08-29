/**
 * Checks if two values are strictly equal.
 * @param actual - value produced by the test
 * @param expected - expected value
 */
export function assertEquals(actual: unknown, expected: unknown): void {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
                throw new Error(`Expected ${expectedStr} but got ${actualStr}`);
        }
}

/**
 * Asserts that an async function rejects.
 * @param fn - function expected to reject
 * @param ErrorClass - expected error constructor
 * @param message - expected error message
 */
export async function assertRejects(
        fn: () => Promise<unknown>,
        ErrorClass: new (...args: any[]) => Error = Error,
        message?: string,
): Promise<void> {
        let thrown = false;
        try {
                await fn();
        } catch (err) {
                thrown = true;
                if (!(err instanceof ErrorClass)) {
                        throw err;
                }
                if (message !== undefined && err.message !== message) {
                        throw new Error(`Expected rejection message ${message} but got ${err.message}`);
                }
        }
        if (!thrown) {
                throw new Error('Expected function to reject');
        }
}

export interface SpyCall {
        args: unknown[];
}

export interface Spy {
        (...args: unknown[]): unknown;
        calls: SpyCall[];
}

/**
 * Wraps a function recording its calls.
 * @param implementation - function to wrap
 * @returns spy function
 */
export function spy(implementation: (...args: unknown[]) => unknown = () => undefined): Spy {
        const fn = ((...args: unknown[]) => {
                fn.calls.push({ args });
                return implementation(...args);
        }) as Spy;
        fn.calls = [];
        return fn;
}
