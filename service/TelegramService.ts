import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import { ModelCommand, setCurrentModel, getCurrentModel, setUserGeminiApiKeysIfAbsent, //
  gptModelCommand, llamaModelCommand, geminiModelCommand, perplexityModelCommand } from '../repository/ChatRepository.ts';
import GeminiService from './GeminiService.ts';
import CloudFlareService from './CloudFlareService.ts';
import OpenAiService from './OpenAIService.ts';
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

  async callAdminModel(ctx: Context, modelCallFunction: (ctx: Context) => Promise<void>): Promise<void> {
    const userId = ctx.from?.id;
    if (ADMIN_USER_ID === userId)
      await this.callModel(ctx, modelCallFunction);
    else
      await this.callModel(ctx, this.replyTextContent);
  },
  
  async callModel(ctx: Context, modelCallFunction: (ctx: Context) => Promise<void>): Promise<void> {
    console.info(`user: ${ctx.msg?.from?.id}, message: ${ctx.message?.text}`);
    try {
      await modelCallFunction(ctx);
    } catch (err) {
      console.error(err);
      await ctx.reply(`Eita, algo deu errado: ${err.message}`,
        { reply_to_message_id: ctx.msg?.message_id })
    }
  },

  async setCurrentModel(ctx: Context): Promise<void> {
    const {userKey, contextMessage: message} = extractContextKeys(ctx);
    await setCurrentModel(userKey, message as ModelCommand);
    ctx.reply(`Novo modelo de inteligência escolhido: ${message}`);
  },

  async replyTextContent(ctx: Context): Promise<void> {
    const { userKey, contextMessage: message } = extractContextKeys(ctx);
    
    switch (await getCurrentModel(userKey)) {
      case gptModelCommand:
        await this.callOpenAIModel(ctx,`gpt: ${message}`);
        return;
      case perplexityModelCommand:
        await this.callPerplexityModel(ctx,`perplexity: ${message}`);
        return;
      case llamaModelCommand:
        await this.callCloudflareModel(ctx,`llama: ${message!}`);
        return;
      case geminiModelCommand:
        await callGeminiModel(ctx);
        return;
      default:
        ctx.reply('Modelo de inteligência não encontrado.', { reply_to_message_id: ctx.message?.message_id });
        return;
    }
  },

  async callPerplexityModel(ctx: Context, commandMessage?: string): Promise<void> {
    const { userKey, contextMessage, quote } = extractContextKeys(ctx);

    const message = commandMessage || contextMessage;

    const openAIService = new OpenAiService('/perplexity');
  
    const output = await openAIService.generateTextResponse(userKey, quote, message!.replace('perplexity:', ''));
    ctx.reply(output, { reply_to_message_id: ctx.message?.message_id });
    return;
  },

  async callOpenAIModel(ctx: Context, commandMessage?: string): Promise<void> {
    const { userKey, contextMessage, quote } = extractContextKeys(ctx);

    const message = commandMessage || contextMessage;

    const command = message!.split(':')[0];
    const openAIService = new OpenAiService('/gpt');
    
    switch (command) {
      case 'gpt': {
          const output = await openAIService.generateTextResponse(userKey, quote, message!.replace('gpt:', ''));
          ctx.reply(output, { reply_to_message_id: ctx.message?.message_id });
          return;
      }
      case 'gptImage': {
          const output = await openAIService.generateImageResponse(userKey, message!.replace('gptImage:', ''));
          const mediaUrls = output.map(imageUrl => InputMediaBuilder.photo(imageUrl));
          ctx.replyWithMediaGroup(mediaUrls, { reply_to_message_id: ctx.message?.message_id });
          return;
      }
    }
  },

  async callCloudflareModel(ctx: Context, commandMessage?: string): Promise<void> {
    const { userKey, contextMessage, quote } = extractContextKeys(ctx);

    const message = commandMessage || contextMessage;

    const cloudflareCommand = message!.split(':')[0];
    let output = ''
    switch (cloudflareCommand) {
      case 'llama':
        output = await CloudFlareService.generateText(userKey, quote, message!.replace('llama:', ''));
        break;
      case 'sql':
        output = await CloudFlareService.generateSQL(userKey, quote, message!.replace('sql:', ''));
        break;
      case 'code':
        output = await CloudFlareService.generateCode(userKey, quote, message!.replace('code:', ''));
        break;
      case 'image':
        ctx.replyWithPhoto(new InputFile(new Uint8Array(await CloudFlareService.generateImage(message!)), 'image/png'), { reply_to_message_id: ctx.message?.message_id });
        return;
    }
    ctx.reply(output!, { reply_to_message_id: ctx.message?.message_id });
  }
}

async function callGeminiModel(ctx: Context): Promise<void> {
  const { userKey, contextMessage: message, photos, caption, quote } = extractContextKeys(ctx);
  
  if (await setUserGeminiApiKeysIfAbsent(userKey, message)) {
    ctx.reply('Chave API do Gemini salva com sucesso!', { reply_to_message_id: ctx.message?.message_id });
    return;
  }

  try {
    const geminiService = await GeminiService.of(userKey);
    const outputMessage = await getGeminiOutput(geminiService, ctx, message, quote, photos, caption);
    ctx.reply(outputMessage, {reply_to_message_id: ctx.message?.message_id});
    return;
  } catch (err) {
    if (err instanceof ApiKeyNotFoundError) {
      ctx.reply('Você precisa me enviar a chave API do Gemini para usar este bot, ex: `key:123456`, para conseguir a chave acesse https://aistudio.google.com/app/apikey?hl=pt-br',
          {reply_to_message_id: ctx.message?.message_id});
      return;
    }
    throw err;
  }
}

async function getGeminiOutput(geminiService: GeminiService, ctx: Context, message: string | undefined, quote: string | undefined, photos: PhotoSize[] | undefined, caption: string | undefined): Promise<string> {
  if (message) {
    return await geminiService.sendTextMessage(quote, message);
  } else if (photos && caption) {
    const photosUrl = getGeminiPhotosUrl(ctx, photos);
    return await geminiService.sendPhotoMessage(quote, photosUrl, caption);
  } else {
    return 'Não entendi o que você quer, me envie uma mensagem de texto ou foto com legenda.';
  }
}

function getGeminiPhotosUrl(ctx: Context, photos: PhotoSize[]): Promise<string>[] {
  return photos.map(async photo => {
    const file = await ctx.api.getFile(photo.file_id);
    const url = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
    return url;
  })
}

function extractContextKeys(ctx: Context) {
  const userId = ctx.from?.id;
  const userKey = `user:${userId}`;
  const contextMessage = ctx.message?.text;
  const photos = ctx.message?.photo;
  const caption = ctx.message?.caption;
  const quote = ctx.message?.reply_to_message?.text;
  return { userId, userKey, contextMessage, photos, caption, quote };
}
