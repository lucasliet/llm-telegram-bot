import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
// import { InputMediaBuilder } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';
import { setUserGeminiApiKeysIfAbsent } from '../repository/ChatRepository.ts';
import GeminiService from './GeminiService.ts';
import ApiNotFoundError from '../error/ApiNotFoundError.ts';

export async function replyContent(ctx: Context, message: string | undefined) {
  const userId = ctx.from?.id;
  const userKey = `user:${userId}`;

  if (!userId || !message) {
    ctx.reply('Error', { reply_to_message_id: ctx.message?.message_id }); 
    console.error(`userId: ${userId}, message: ${message}`)
    return;
  }

  if(await setUserGeminiApiKeysIfAbsent(userKey, message)) {
    ctx.reply('Chave API do Gemini salva com sucesso!', { reply_to_message_id: ctx.message?.message_id });
    return;
  }

  try {
    const geminiService = await GeminiService.of(userKey);
    const outputMessage = await geminiService.sendMessage(message);
    ctx.reply(outputMessage, { reply_to_message_id: ctx.message?.message_id });
  } catch (err) {
    if (err instanceof ApiNotFoundError) {
      ctx.reply('Você precisa me enviar a chave API do Gemini para usar este bot, ex: `key:123456`, para conseguir a chave acesse https://aistudio.google.com/app/apikey?hl=pt-br',
        { reply_to_message_id: ctx.message?.message_id });
      return;
    }
    ctx.reply(`Eita, algo deu errado: ${err.message}`, { reply_to_message_id: ctx.message?.message_id });
    console.error(err);
  }
}