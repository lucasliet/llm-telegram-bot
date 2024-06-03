import { compressObject, compressText, decompressObject, decompressText } from "https://deno.land/x/textcompress@v1.0.0/mod.ts";
import { Content } from "npm:@google/generative-ai";
import { ApiNotFoundError } from "../error/ApiNotFoundError.ts";
import GeminiService from "../service/GeminiService.ts";

const kv = await Deno.openKv();
const oneDayInMillis = 60 * 60 * 24 * 1000;

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
  if (!compressedKey) throw new ApiNotFoundError('API key not found');
  return decompressText(compressedKey);
}

export async function getChatHistory(userKey: string): Promise<Content[]> {
  const compressedChatHistory = (await kv.get<string>([userKey, 'chat-history'])).value;
  if (!compressedChatHistory) return [
    { role: 'user', parts: [{ text: '' }] },
    { role: 'model', parts: [{ text: GeminiService.tone() }] }
  ];

  return decompressObject<Content[]>(compressedChatHistory);
}

export async function addChatToHistory(history: Content[], userKey: string): Promise<void> {
  const compressedChatHistory = compressObject(history);
  await kv.set([userKey, 'chat-history'], compressedChatHistory, { expireIn: oneDayInMillis });
}