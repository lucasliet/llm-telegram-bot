export const WEBHOOK_SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token';

/**
 * Derive the webhook `secret_token` from the bot token, so only whoever holds the token can produce it.
 * Telegram only accepts `A-Z`, `a-z`, `0-9`, `_` and `-` (the raw token contains `:`), hence the SHA-256 hex digest.
 * @param botToken - Telegram bot token
 * @returns 64-char lowercase hex digest sent by Telegram in the `X-Telegram-Bot-Api-Secret-Token` header
 */
export async function deriveWebhookSecret(botToken: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(botToken));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Compare the received secret header with the expected one in constant time.
 * @param received - Header value sent with the request (null when absent)
 * @param expected - Secret derived from the bot token
 * @returns True only when both values are identical
 */
export function isValidWebhookSecret(received: string | null | undefined, expected: string): boolean {
	if (!received || received.length !== expected.length) return false;
	let difference = 0;
	for (let index = 0; index < expected.length; index++) {
		difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
	}
	return difference === 0;
}
