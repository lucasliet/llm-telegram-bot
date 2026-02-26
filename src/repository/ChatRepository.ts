import { compressObject, decompressObject } from 'textcompress';
import { Content } from '@google/generative-ai';
import { ModelCommand } from '@/config/models.ts';

const kv = await Deno.openKv();

const THIRTY_DAYS_IN_MILLIS = 60 * 60 * 24 * 1000 * 30;

/**
 * Get chat history for a user
 */
export async function getChatHistory(userKey: string): Promise<Content[]> {
	const compressedChatHistory = (await kv.get<string>([userKey, 'chat-history'])).value;

	if (!compressedChatHistory) {
		return [];
	}

	return decompressObject<Content[]>(compressedChatHistory);
}

/**
 * Add new content to chat history
 */
export async function addContentToChatHistory(
	history: Content[],
	quote: string = '',
	userPrompt: string,
	modelPrompt: string,
	userKey: string,
): Promise<void> {
	const userPart = quote ? [{ text: quote }, { text: userPrompt }] : [{ text: userPrompt }];

	history = [
		...history,
		{ role: 'user', parts: userPart },
		{ role: 'model', parts: [{ text: modelPrompt }] },
	];

	await saveHistoryToStorage(history, userKey);
}

/**
 * Save chat history to storage with compression
 */
async function saveHistoryToStorage(history: Content[], userKey: string): Promise<void> {
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
export async function overwriteChatHistory(userKey: string, history: Content[]): Promise<void> {
	const compressedChatHistory = compressObject(history);
	await kv.set([userKey, 'chat-history'], compressedChatHistory, {
		expireIn: THIRTY_DAYS_IN_MILLIS,
	});
}

/**
 * Set user's current model preference
 */
export async function setCurrentModel(userKey: string, model: ModelCommand = '/polli'): Promise<void> {
	await kv.set([userKey, 'current_model'], model);
}

/**
 * Get user's current model preference (defaults to /polli)
 */
export async function getCurrentModel(userKey: string): Promise<ModelCommand> {
	return (await kv.get<ModelCommand>([userKey, 'current_model'])).value || '/polli';
}
