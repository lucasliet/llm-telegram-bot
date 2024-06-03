import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
// import { InputMediaBuilder } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';
import { setUserGeminiApiKeysIfAbsent } from '../repository/ChatRepository.ts';
import GeminiService from './GeminiService.ts';
import { ApiNotFoundError } from '../error/ApiNotFoundError.ts';
import { PhotoSize } from 'https://deno.land/x/grammy@v1.17.2/types.deno.ts';

const TOKEN = Deno.env.get('BOT_TOKEN') as string;

export async function replyTextContent(ctx: Context) {
  const userId = ctx.from?.id;
  const userKey = `user:${userId}`;
  const message = ctx.message?.text;
  const photos = ctx.message?.photo;
  const caption = ctx.message?.caption;

  if (await setUserGeminiApiKeysIfAbsent(userKey, message)) {
    ctx.reply('Chave API do Gemini salva com sucesso!', { reply_to_message_id: ctx.message?.message_id });
    return;
  }

  try {
    const geminiService = await GeminiService.of(userKey);
    if (message) {
      const outputMessage = await geminiService.sendTextMessage(message);
      ctx.reply(outputMessage, { reply_to_message_id: ctx.message?.message_id });
    } else if (photos && caption) {
      const photoPaths = getPhotos(ctx, photos);
      const outputMessage = await geminiService.sendPhotoMessage(photoPaths, caption);
      ctx.reply(outputMessage, { reply_to_message_id: ctx.message?.message_id });
    } else {
      ctx.reply('Não entendi o que você quer, me envie uma mensagem ou foto.', { reply_to_message_id: ctx.message?.message_id });
    }
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

function getPhotos(ctx: Context, photos: PhotoSize[]): Promise<string>[] {
  return photos.map(async photo => {
    const file = await ctx.api.getFile(photo.file_id);
    const url = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
    return url;
  })
}