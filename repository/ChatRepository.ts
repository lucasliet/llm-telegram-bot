import { compressObject, compressText, decompressObject, decompressText } from "https://deno.land/x/textcompress@v1.0.0/mod.ts";
import { Content } from "npm:@google/generative-ai";
import { ApiKeyNotFoundError } from "../error/ApiKeyNotFoundError.ts";

const kv = await Deno.openKv();
const oneDayInMillis = 60 * 60 * 24 * 1000;

export type ModelCommand = '/gemini' | '/llama' | '/gpt' | '/perplexity' | '/perplexityReasoning' | '/blackbox' | '/r1';

export const modelCommands: ModelCommand[] = ['/gemini', '/llama', '/gpt', '/perplexity','/perplexityReasoning', '/blackbox', '/r1'];
export const [ geminiModelCommand, llamaModelCommand, gptModelCommand, perplexityModelCommand, perplexityReasoningModelCommand, blackboxModelCommand, blackboxReasoningModelCommand ] = modelCommands;

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

export async function getChatHistory(userKey: string): Promise<Content[]> {
  const compressedChatHistory = (await kv.get<string>([userKey, 'chat-history'])).value;
  if (!compressedChatHistory) return [];

  return decompressObject<Content[]>(compressedChatHistory);
}

export async function addChatToHistory(history: Content[], quote: string = '', userPrompt: string, modelPrompt: string, userKey: string): Promise<void> {
  const userPart = quote ? [{ text: quote }, { text: userPrompt }] : [{ text: userPrompt }];
  history = [ ...history, { role: 'user', parts: userPart }, { role: 'model', parts: [{ text: modelPrompt }] } ]
  await addContentToChatHistory(history, userKey);
}

function removeOldMessages<T>(history: Array<T>, maxsize: number) {
  if (history.length > maxsize) history.splice(0, history.length - maxsize);
}

export async function addContentToChatHistory(history: Content[], userKey: string): Promise<void> {
  removeOldMessages(history, 100);
  const compressedChatHistory = compressObject(history);
  await kv.set([userKey, 'chat-history'], compressedChatHistory, { expireIn: oneDayInMillis * 7 });
}

export async function clearChatHistory(userKey: string): Promise<void> {
  await kv.delete([userKey, 'chat-history']);
}

export async function setCurrentModel(userKey: string, model: ModelCommand = '/gemini'): Promise<void> {
  await kv.set([userKey, 'current_model'], model);
}

export async function getCurrentModel(userKey: string): Promise<ModelCommand> {
  return (await kv.get<ModelCommand>([userKey, 'current_model'])).value || '/blackbox';
}

export async function cacheTranscribedAudio(keys: string[], audio: string, ): Promise<void> {
  await kv.set([...keys], compressText(audio), { expireIn: oneDayInMillis / 2 });
}

export async function getTranscribedAudio(keys: string[]): Promise<string| null> {
  const cachedAudio = (await kv.get<string>([...keys])).value;
  return cachedAudio ? decompressText(cachedAudio) : null;
}