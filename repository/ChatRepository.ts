import { compressObject, compressText, decompressObject, decompressText } from "https://deno.land/x/textcompress@v1.0.0/mod.ts";
import { Content } from "npm:@google/generative-ai";
import { ApiKeyNotFoundError } from "../error/ApiKeyNotFoundError.ts";

/**
 * Open a connection to Deno KV store
 */
const kv = await Deno.openKv();

/**
 * Constants for time-based operations
 */
const ONE_DAY_IN_MILLIS = 60 * 60 * 24 * 1000;
const THIRTY_DAYS_IN_MILLIS = ONE_DAY_IN_MILLIS * 30;

/**
 * Type definitions
 */
export type ModelCommand = '/gemini' | '/llama' | '/gpt' 
  | '/perplexity' | '/perplexityReasoning' 
  | '/v3' | '/r1' | '/qwen' | '/mixtral';

export interface ExpirableContent extends Content { 
  createdAt: number 
}

/**
 * Available model commands
 */
export const modelCommands: ModelCommand[] = [
  '/gemini', '/llama', '/gpt',
  '/perplexity','/perplexityReasoning', 
  '/v3', '/r1', '/qwen', '/mixtral'
];

/**
 * Named model commands for improved readability
 */
export const [
  geminiModelCommand,
  llamaModelCommand,
  gptModelCommand,
  perplexityModelCommand,
  perplexityReasoningModelCommand,
  blackboxModelCommand,
  blackboxReasoningModelCommand,
  blackboxQwenModelCommand,
  blackboxMixtralModelCommand
] = modelCommands;

/**
 * Store API key for Gemini if user provides it
 */
export async function setUserGeminiApiKeysIfAbsent(userKey: string, message: string | undefined): Promise<boolean> {
  if (message && message.startsWith('key:')) {
    const apiKey = message.replace('key:', '');
    const compressedKey = compressText(apiKey);
    await kv.set([userKey, 'api-key'], compressedKey);
    return true;
  } 
  return false;
}

/**
 * Retrieve user's Gemini API key
 * @throws ApiKeyNotFoundError if the key doesn't exist
 */
export async function getUserGeminiApiKeys(userKey: string): Promise<string> {
  const compressedKey = (await kv.get<string>([userKey, 'api-key'])).value;
  
  if (!compressedKey) {
    throw new ApiKeyNotFoundError('API key not found');
  }
  
  return decompressText(compressedKey);
}

/**
 * Get chat history for a user
 */
export async function getChatHistory(userKey: string): Promise<ExpirableContent[]> {
  const compressedChatHistory = (await kv.get<string>([userKey, 'chat-history'])).value;
  
  if (!compressedChatHistory) {
    return [];
  }

  return addCreatedAtToMissingProperties(decompressObject<ExpirableContent[]>(compressedChatHistory));
}

/**
 * Add createdAt property to messages that are missing it
 */
function addCreatedAtToMissingProperties(history: ExpirableContent[]): ExpirableContent[] {
  return history.map(message => ({
    ...message, 
    createdAt: message.createdAt || Date.now() 
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
  userKey: string
): Promise<void> {
  const createdAt = Date.now();
  const userPart = quote ? [{ text: quote }, { text: userPrompt }] : [{ text: userPrompt }];
  
  // Add user message and model response to history
  history = [ 
    ...history, 
    { role: 'user', parts: userPart, createdAt }, 
    { role: 'model', parts: [{ text: modelPrompt }], createdAt } 
  ];
  
  await saveHistoryToStorage(history, userKey);
}

/**
 * Filter out expired messages from history
 */
function removeExpiredMessages(history: Array<ExpirableContent>, expirationInMillis: number): ExpirableContent[] {
  const expirationThreshold = Date.now() - expirationInMillis;
  return history.filter(message => message.createdAt >= expirationThreshold);
}

/**
 * Save chat history to storage with compression
 */
async function saveHistoryToStorage(history: ExpirableContent[], userKey: string): Promise<void> {
  // Remove messages older than 1 day
  history = removeExpiredMessages(history, ONE_DAY_IN_MILLIS);
  
  // Compress and store with 30-day expiration
  const compressedChatHistory = compressObject(history);
  await kv.set([userKey, 'chat-history'], compressedChatHistory, { expireIn: THIRTY_DAYS_IN_MILLIS });
}

/**
 * Clear chat history for a user
 */
export async function clearChatHistory(userKey: string): Promise<void> {
  await kv.delete([userKey, 'chat-history']);
}

/**
 * Set user's current model preference
 */
export async function setCurrentModel(userKey: string, model: ModelCommand = '/v3'): Promise<void> {
  await kv.set([userKey, 'current_model'], model);
}

/**
 * Get user's current model preference (defaults to /v3)
 */
export async function getCurrentModel(userKey: string): Promise<ModelCommand> {
  return (await kv.get<ModelCommand>([userKey, 'current_model'])).value || '/v3';
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