import { compressObject, decompressObject } from 'textcompress';
import OpenAI from 'openai';
import { ModelCommand } from '@/config/models.ts';
import { getKeyValueStore } from '@/repository/KeyValueStore.ts';

const THIRTY_DAYS_IN_MILLIS = 60 * 60 * 24 * 1000 * 30;

/**
 * Build the storage key for a user-scoped record.
 */
function userRecordKey(userKey: string, record: 'chat-history' | 'current_model'): string {
	return `${userKey}:${record}`;
}

/**
 * Expiration timestamp applied to every chat history write.
 */
function chatHistoryExpiration(): { expiresAt: Date } {
	return { expiresAt: new Date(Date.now() + THIRTY_DAYS_IN_MILLIS) };
}

/**
 * Get chat history for a user
 */
export async function getChatHistory(userKey: string): Promise<OpenAI.ChatCompletionMessageParam[]> {
	const compressed = await getKeyValueStore().get<string>(userRecordKey(userKey, 'chat-history'));

	if (!compressed) {
		return [];
	}

	return decompressObject<OpenAI.ChatCompletionMessageParam[]>(compressed);
}

/**
 * Add new content to chat history
 */
export async function addContentToChatHistory(
	history: OpenAI.ChatCompletionMessageParam[],
	userPrompt: string,
	modelPrompt: string,
	userKey: string,
): Promise<void> {
	history = [
		...history,
		{ role: 'user', content: userPrompt },
		{ role: 'assistant', content: modelPrompt },
	];

	await saveHistoryToStorage(history, userKey);
}

/**
 * Save chat history to storage with compression
 */
async function saveHistoryToStorage(history: OpenAI.ChatCompletionMessageParam[], userKey: string): Promise<void> {
	const compressed = compressObject(history);
	await getKeyValueStore().set(userRecordKey(userKey, 'chat-history'), compressed, chatHistoryExpiration());
}

/**
 * Clear chat history for a user
 */
export async function clearChatHistory(userKey: string): Promise<void> {
	await getKeyValueStore().delete(userRecordKey(userKey, 'chat-history'));
}

/**
 * Overwrite chat history with a new history (used after compression)
 */
export async function overwriteChatHistory(userKey: string, history: OpenAI.ChatCompletionMessageParam[]): Promise<void> {
	const compressed = compressObject(history);
	await getKeyValueStore().set(userRecordKey(userKey, 'chat-history'), compressed, chatHistoryExpiration());
}

/**
 * Set user's current model preference
 */
export async function setCurrentModel(userKey: string, model: ModelCommand = '/free'): Promise<void> {
	await getKeyValueStore().set(userRecordKey(userKey, 'current_model'), model);
}

/**
 * Get user's current model preference (defaults to /free)
 */
export async function getCurrentModel(userKey: string): Promise<ModelCommand> {
	return (await getKeyValueStore().get<ModelCommand>(userRecordKey(userKey, 'current_model'))) || '/free';
}
