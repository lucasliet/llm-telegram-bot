import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import { setUserGeminiApiKeysIfAbsent } from '../repository/ChatRepository.ts';
import GeminiService from './GeminiService.ts';
import CloudFlareService from './CloudFlareService.ts';
import ChatGPTService from './ChatGPTService.ts';
import { ApiKeyNotFoundError } from '../error/ApiKeyNotFoundError.ts';
import { InputFile, PhotoSize } from 'https://deno.land/x/grammy@v1.17.2/types.deno.ts';
import { InputMediaBuilder } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';

const TOKEN = Deno.env.get('BOT_TOKEN') as string;
const ADMIN_USER_ID: number = parseInt(Deno.env.get('ADMIN_USER_ID') as string);

export default {
  setWebhook: (): Promise<Response> => fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: 'https://llm-telegram-bot.deno.dev/webhook'
    })
  }),
  async replyTextContent(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    const userKey = `user:${userId}`;
    const message = ctx.message?.text;
    const photos = ctx.message?.photo;
    const caption = ctx.message?.caption;
    const quote = ctx.message?.reply_to_message?.text;

    if (await setUserGeminiApiKeysIfAbsent(userKey, message)) {
      ctx.reply('Chave API do Gemini salva com sucesso!', { reply_to_message_id: ctx.message?.message_id });
      return;
    }

    const isBetaCommand = message?.match(/^[a-zA-Z]{3,8}:/g);
    if (isBetaCommand && userId === ADMIN_USER_ID) {
      if (message!.startsIn('llama', 'sql', 'code')) {
        const output = await callBetaCloudflareTextModel(userKey, quote, message!);
        ctx.reply(output!, { reply_to_message_id: ctx.message?.message_id });
        return;
      }
      if (message!.startsIn('gpt', 'gptImage')) {
        await callAdminGPTFunctions(ctx, userKey, message, quote);
        return;
      }
    }

    try {
      const geminiService = await GeminiService.of(userKey);
      const outputMessage = await getGeminiOutput(geminiService, ctx, message, quote, photos, caption);
      ctx.reply(outputMessage, { reply_to_message_id: ctx.message?.message_id });
      return;
    } catch (err) {
      if (err instanceof ApiKeyNotFoundError) {
        ctx.reply('Você precisa me enviar a chave API do Gemini para usar este bot, ex: `key:123456`, para conseguir a chave acesse https://aistudio.google.com/app/apikey?hl=pt-br',
          { reply_to_message_id: ctx.message?.message_id });
        return;
      }
      ctx.reply(`Eita, algo deu errado: ${err.message}`, { reply_to_message_id: ctx.message?.message_id });
      console.error(err);
      return;
    }
  },
  async replyImageContent(ctx: Context): Promise<void> {
    const message = ctx.message!.text!;

    try {
      const imageArrayBuffer = await CloudFlareService.generateImage(message);
      ctx.replyWithPhoto(new InputFile(new Uint8Array(imageArrayBuffer), 'image/png'), { reply_to_message_id: ctx.message?.message_id });
      return;
    } catch (err) {
      ctx.reply(`Eita, algo deu errado: ${err.message}`, { reply_to_message_id: ctx.message?.message_id });
      console.error(err);
      return;
    }
  }
}

async function getGeminiOutput(geminiService: GeminiService, ctx: Context, message: string | undefined, quote: string | undefined, photos: PhotoSize[] | undefined, caption: string | undefined): Promise<string> {
  if (message) {
    return await geminiService.sendTextMessage(quote, message);
  } else if (photos && caption) {
    const photosUrl = getPhotosUrl(ctx, photos);
    return await geminiService.sendPhotoMessage(quote, photosUrl, caption);
  } else {
    return 'Não entendi o que você quer, me envie uma mensagem de texto ou foto com legenda.';
  }
}

function getPhotosUrl(ctx: Context, photos: PhotoSize[]): Promise<string>[] {
  return photos.map(async photo => {
    const file = await ctx.api.getFile(photo.file_id);
    const url = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
    return url;
  })
}

async function callBetaCloudflareTextModel(userKey: string, quote: string | undefined, message: string): Promise<string | undefined> {
  const cloudflareCommand = message.split(':')[0];

  switch (cloudflareCommand) {
    case 'llama':
      return await CloudFlareService.generateText(userKey, quote, message.replace('llama:', ''));
    case 'sql':
      return await CloudFlareService.generateSQL(userKey, quote, message.replace('sql:', ''));
    case 'code':
      return await CloudFlareService.generateCode(userKey, quote, message.replace('code:', ''));
  }
}

async function callAdminGPTFunctions(ctx: Context, userKey: string, message: string | undefined, quote: string | undefined) {
  const command = message!.split(':')[0];
  if (command === 'gpt') {
    const output = await ChatGPTService.generateTextResponse(userKey, quote, message!.replace('gpt:', ''));
    ctx.reply(output, { reply_to_message_id: ctx.message?.message_id });
    return;
  } else if (command === 'gptImage') {
    const output = await ChatGPTService.generateImageResponse(userKey, message!.replace('gptImage:', ''));
    const mediaUrls = output.map(imageUrl => InputMediaBuilder.photo(imageUrl));
    ctx.replyWithMediaGroup(mediaUrls, { reply_to_message_id: ctx.message?.message_id });
    return;
  }
}
