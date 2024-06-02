import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import { compressObject, compressText, decompressObject, decompressText } from "https://deno.land/x/textcompress@v1.0.0/mod.ts";
// import { InputMediaBuilder } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';
import { GoogleGenerativeAI, GenerativeModel, Content } from 'npm:@google/generative-ai'

const kv = await Deno.openKv();
const geminiModel = 'gemini-1.5-flash';
const oneDayInMillis = 60 * 60 * 24 * 1000;

export async function replyMediaContent(ctx: Context, message: string | undefined) {
  const userId = ctx.from?.id;
  if (!userId || !message) {
    ctx.reply('Error', { reply_to_message_id: ctx.message?.message_id }); 
    console.error(`userId: ${userId}, message: ${message}`)
    return;
  }
  const userKey = `user:${userId}`;

  if(await setUserGeminiApiKeysIfAbsent(userKey, message)) {
    ctx.reply('Chave API do Gemini salva com sucesso!', { reply_to_message_id: ctx.message?.message_id });
    return;
  }

  const apiKey = await getUserGeminiApiKeys(userKey);
  if (!apiKey) {
    ctx.reply('Você precisa me enviar a chave API do Gemini para usar este bot, ex: `key:123456`, para conseguir a chave acesse https://aistudio.google.com/app/apikey?hl=pt-br',
      { reply_to_message_id: ctx.message?.message_id });
    return;
  }

  const genAi = new GoogleGenerativeAI(apiKey);
  const model = genAi.getGenerativeModel({ model: geminiModel });

  const history = await getChatHistory(userKey);
  const chat = buildChat(model, history);

  const response = (await chat.sendMessage(message)).response.text();

  await addChatToHistory(history, userKey, message, response);

  ctx.reply(response, { reply_to_message_id: ctx.message?.message_id });
}
async function getUserGeminiApiKeys(userKey: string) {  
  const compressedKey = (await kv.get<string>([userKey, 'api-key'])).value;
  if (!compressedKey) return;

  return decompressText(compressedKey);
}

async function setUserGeminiApiKeysIfAbsent(userKey: string, message: string) {
  if (message && message.startsWith('key:')) {
    const apiKey = message.replace('key:', '');
    const compressedKey = compressText(apiKey);
    await kv.set([userKey, 'api-key'], compressedKey);
    return true;
  } else return false;
}

async function getChatHistory(userKey: string) {
  const compressedChatHistory = (await kv.get<string>([userKey, 'chat-history'])).value;
  if(!compressedChatHistory) return [];

  return decompressObject<Content[]>(compressedChatHistory);
}

async function addChatToHistory(history: Content[], userKey: string, message: string, response: string) {
  const newHistory = [
    ...history,
    { role: 'user', parts: [{ text: message }] },
    { role: 'model', parts: [{ text: response }] }
  ]
  const compressedChatHistory = compressObject(newHistory);
  await kv.set([userKey, 'chat-history'], compressedChatHistory, { expireIn: oneDayInMillis });
}

function buildChat(model: GenerativeModel, history: Content[]) {
  return model.startChat({
    history,
    generationConfig: {
      maxOutputTokens: 200,
      topP: 0.9,
      temperature: 0.8
    }
  });
}