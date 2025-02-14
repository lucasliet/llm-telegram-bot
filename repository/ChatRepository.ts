import { compressObject, compressText, decompressObject, decompressText } from "https://deno.land/x/textcompress@v1.0.0/mod.ts";
import { Content } from "npm:@google/generative-ai";
import { ApiKeyNotFoundError } from "../error/ApiKeyNotFoundError.ts";

const kv = await Deno.openKv();
const oneDayInMillis = 60 * 60 * 24 * 1000;

export type ModelCommand = '/gemini' | '/llama' | '/gpt' 
  | '/perplexity' | '/perplexityReasoning' 
  | '/v3' | '/r1' | '/qwen' | '/mixtral';

export const modelCommands: ModelCommand[] = ['/gemini', '/llama', '/gpt',
  '/perplexity','/perplexityReasoning', 
  '/v3', '/r1', '/qwen', '/mixtral'];
export const [ geminiModelCommand, llamaModelCommand, gptModelCommand, 
  perplexityModelCommand, perplexityReasoningModelCommand, 
  blackboxModelCommand, blackboxReasoningModelCommand, blackboxQwenModelCommand, blackboxMixtralModelCommand ] = modelCommands;

export interface ExpirableContent extends Content { createdAt: number }

export async function setUserGeminiApiKeysIfAbsent(userKey: string, message: string | undefined): Promise<boolean> {
  if (message && message.startsWith('key:')) {
    const apiKey = message.replace('key:', '');
    const compressedKey = compressText(apiKey);
    await kv.set([userKey, 'api-key'], compressedKey);
    return true;
  } else return false;
}

export async function getUserGeminiApiKeys(userKey: string): Promise<string> {
  const compressedKey = (await kv.get<string>([userKey, 'api-key'])).value;
  if (!compressedKey) throw new ApiKeyNotFoundError('API key not found');
  return decompressText(compressedKey);
}

export async function getChatHistory(userKey: string): Promise<ExpirableContent[]> {
  const compressedChatHistory = (await kv.get<string>([userKey, 'chat-history'])).value;
  if (!compressedChatHistory) return [];

  return _addCreatedAtToMessageMissingProperty(decompressObject<ExpirableContent[]>(compressedChatHistory));
}

function _addCreatedAtToMessageMissingProperty(history: ExpirableContent[]): ExpirableContent[] {
  return history.map(message => ({...message, createdAt: message.createdAt || Date.now() }));
}

export async function addContentToChatHistory(history: ExpirableContent[], quote: string = '', userPrompt: string, modelPrompt: string, userKey: string): Promise<void> {
  const createdAt = Date.now();
  const userPart = quote ? [{ text: quote }, { text: userPrompt }] : [{ text: userPrompt }];
  history = [ ...history, { role: 'user', parts: userPart, createdAt }, { role: 'model', parts: [{ text: modelPrompt }], createdAt } ]
  await _addChatToHistory(history, userKey);
}

function removeExpiredMessages(history: Array<ExpirableContent>, expirationInMillis: number): ExpirableContent[] {
  return history.filter(message => message.createdAt >= Date.now() - expirationInMillis);
}

async function _addChatToHistory(history: ExpirableContent[], userKey: string): Promise<void> {
  history = removeExpiredMessages(history, oneDayInMillis);
  const compressedChatHistory = compressObject(history);
  await kv.set([userKey, 'chat-history'], compressedChatHistory, { expireIn: oneDayInMillis * 30 });
}

export async function clearChatHistory(userKey: string): Promise<void> {
  await kv.delete([userKey, 'chat-history']);
}

export async function setCurrentModel(userKey: string, model: ModelCommand = '/v3'): Promise<void> {
  await kv.set([userKey, 'current_model'], model);
}

export async function getCurrentModel(userKey: string): Promise<ModelCommand> {
  return (await kv.get<ModelCommand>([userKey, 'current_model'])).value || '/v3';
}

export async function setVqdHeader(vqdHeader: string): Promise<void> {
  await kv.set(['vqd_header'], vqdHeader, { expireIn: oneDayInMillis / 20 });
}

export async function getVqdHeader(): Promise<string | null> {
  return (await kv.get<string>(['vqd_header'])).value || null;
}