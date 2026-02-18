import { compressObject, decompressObject } from 'textcompress';
import { Content } from '@google/generative-ai';
import { ModelCommand } from '@/config/models.ts';

/**
 * Open a connection to Deno KV store
 */
const kv = await Deno.openKv();

/**
 * Constants for time-based operations
 */
const ONE_DAY_IN_MILLIS = 60 * 60 * 24 * 1000;
const THIRTY_DAYS_IN_MILLIS = ONE_DAY_IN_MILLIS * 30;

export interface ExpirableContent extends Content {
	createdAt: number;
}

/**
 * Get chat history for a user
 */
export async function getChatHistory(
	userKey: string,
): Promise<ExpirableContent[]> {
	const compressedChatHistory = (await kv.get<string>([userKey, 'chat-history'])).value;

	if (!compressedChatHistory) {
		return [];
	}

	return addCreatedAtToMissingProperties(
		decompressObject<ExpirableContent[]>(compressedChatHistory),
	);
}

/**
 * Add createdAt property to messages that are missing it
 */
function addCreatedAtToMissingProperties(
	history: ExpirableContent[],
): ExpirableContent[] {
	return history.map((message) => ({
		...message,
		createdAt: message.createdAt || Date.now(),
	}));
}

/**
 * Add new content to chat history
 */
export async function addContentToChatHistory(
	history: ExpirableContent[],
	quote: string = '',
	userPrompt: string,
	modelPrompt: string,
	userKey: string,
): Promise<void> {
	const createdAt = Date.now();
	const userPart = quote ? [{ text: quote }, { text: userPrompt }] : [{ text: userPrompt }];

	history = [
		...history,
		{ role: 'user', parts: userPart, createdAt },
		{ role: 'model', parts: [{ text: modelPrompt }], createdAt },
	];

	await saveHistoryToStorage(history, userKey);
}

/**
 * Filter out expired messages from history
 */
function removeExpiredMessages(
	history: Array<ExpirableContent>,
	expirationInMillis: number,
): ExpirableContent[] {
	const expirationThreshold = Date.now() - expirationInMillis;
	return history.filter((message) => message.createdAt >= expirationThreshold);
}

/**
 * Save chat history to storage with compression
 */
async function saveHistoryToStorage(
	history: ExpirableContent[],
	userKey: string,
): Promise<void> {
	history = removeExpiredMessages(history, ONE_DAY_IN_MILLIS);

	const compressedChatHistory = compressObject(history);
	await kv.set([userKey, 'chat-history'], compressedChatHistory, {
		expireIn: THIRTY_DAYS_IN_MILLIS,
	});
}

/**
 * Clear chat history for a user
 */
export async function clearChatHistory(userKey: string): Promise<void> {
	await kv.delete([userKey, 'chat-history']);
}

/**
 * Overwrite chat history with a new history (used after compression)
 */
export async function overwriteChatHistory(
	userKey: string,
	history: ExpirableContent[],
): Promise<void> {
	const compressedChatHistory = compressObject(history);
	await kv.set([userKey, 'chat-history'], compressedChatHistory, {
		expireIn: THIRTY_DAYS_IN_MILLIS,
	});
}

/**
 * Set user's current model preference
 */
export async function setCurrentModel(
	userKey: string,
	model: ModelCommand = '/polli',
): Promise<void> {
	await kv.set([userKey, 'current_model'], model);
}

/**
 * Get user's current model preference (defaults to /polli)
 */
export async function getCurrentModel(userKey: string): Promise<ModelCommand> {
	return (await kv.get<ModelCommand>([userKey, 'current_model'])).value ||
		'/polli';
}

/**
 * Set VQD header for DuckDuckGo searches (short expiration)
 */
export async function setVqdHeader(vqdHeader: string): Promise<void> {
	await kv.set(['vqd_header'], vqdHeader, { expireIn: ONE_DAY_IN_MILLIS / 20 });
}

/**
 * Get VQD header for DuckDuckGo searches
 */
export async function getVqdHeader(): Promise<string | null> {
	return (await kv.get<string>(['vqd_header'])).value || null;
}
