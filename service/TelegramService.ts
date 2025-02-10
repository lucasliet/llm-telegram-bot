import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import { ModelCommand, setCurrentModel, getCurrentModel, setUserGeminiApiKeysIfAbsent,
  gptModelCommand, llamaModelCommand, geminiModelCommand, perplexityModelCommand, 
  blackboxModelCommand, blackboxReasoningModelCommand, perplexityReasoningModelCommand,
  modelCommands,
  } from '../repository/ChatRepository.ts';
import GeminiService from './GeminiService.ts';
import CloudFlareService from './CloudFlareService.ts';
import OpenAiService from './OpenAIService.ts';
import { ApiKeyNotFoundError } from '../error/ApiKeyNotFoundError.ts';
import { Audio, InputFile, PhotoSize, Voice } from 'https://deno.land/x/grammy@v1.17.2/types.deno.ts';
import { InputMediaBuilder } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';
import BlackboxaiService from './BlackboxaiService.ts';

const TOKEN = Deno.env.get('BOT_TOKEN') as string;
const ADMIN_USER_IDS: number[] = (Deno.env.get('ADMIN_USER_IDS') as string).split('|').map(id => parseInt(id));
const WHITELISTED_MODELS: ModelCommand[] = [ llamaModelCommand, blackboxModelCommand, blackboxReasoningModelCommand ];

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

  callAdminModel(ctx: Context, modelCallFunction: (ctx: Context) => Promise<void>): void {
    const userId = ctx.from?.id!;
    if (ADMIN_USER_IDS.includes(userId))
      this.callModel(ctx, modelCallFunction);
    else
      this.callModel(ctx, this.replyTextContent);
  },
  
  callModel(ctx: Context, modelCallFunction: (ctx: Context) => Promise<void>): void {
    console.info(`user: ${ctx.msg?.from?.id}, message: ${ctx.message?.text}`);
    
    const startTime = Date.now();
    const keepAliveId = keepDenoJobAlive();
    const timeoutId = ctx.replyOnLongAnswer();

    modelCallFunction(ctx).then(() => {
      clearTimeout(timeoutId);
      clearInterval(keepAliveId);
      console.log(`Request processed in ${Date.now() - startTime}ms`);
    }).catch((err) => {
      clearTimeout(timeoutId);
      clearInterval(keepAliveId);
      console.error(err);
      ctx.reply(`Eita, algo deu errado: ${err.message}`,
        { reply_to_message_id: ctx.msg?.message_id });
    });
  },

  async getAdminIds(ctx: Context): Promise<number[]> {
    const { userId } = await ctx.extractContextKeys();
    if (ADMIN_USER_IDS.includes(userId!)) return ADMIN_USER_IDS;
    return [];
  },

  async getCurrentModel(ctx: Context): Promise<ModelCommand> {
    const { userKey } = await ctx.extractContextKeys();
    return getCurrentModel(userKey);
  },

  async setCurrentModel(ctx: Context): Promise<void> {
    console.info(`user: ${ctx.msg?.from?.id}, message: ${ctx.message?.text}`);
    const { userId, userKey, contextMessage: message } = await ctx.extractContextKeys();

    const command = (message || ctx.callbackQuery?.data) as ModelCommand

    if (!modelCommands.includes(command) || !ADMIN_USER_IDS.includes(userId!) && !WHITELISTED_MODELS.includes(command)) return;

    await setCurrentModel(userKey, command);
    ctx.reply(`Novo modelo de inteligência escolhido: ${command}`);
  },

  async replyTextContent(ctx: Context): Promise<void> {
    const { userKey, contextMessage: message } = await ctx.extractContextKeys();
    
    switch (await getCurrentModel(userKey)) {
      case gptModelCommand:
        await _callOpenAIModel(ctx,`gpt: ${message}`);
        return;
      case perplexityModelCommand:
        await _callPerplexityModel(ctx,`perplexity: ${message}`);
        return;
      case perplexityReasoningModelCommand:
        await _callPerplexityModel(ctx,`perplexityReasoning: ${message}`);
        return;
      case llamaModelCommand:
        await _callCloudflareModel(ctx,`llama: ${message!}`);
        return;
      case blackboxModelCommand:
        await _callBlackboxModel(ctx,`blackbox: ${message}`);
        return;
      case blackboxReasoningModelCommand:
        await _callBlackboxModel(ctx,`r1: ${message}`);
        return;
      case geminiModelCommand:
        await _callGeminiModel(ctx);
        return;
      default:
        ctx.reply('Modelo de inteligência não encontrado.', { reply_to_message_id: ctx.message?.message_id });
        return;
    }
  },

  async callPerplexityModel(ctx: Context, commandMessage?: string): Promise<void> {
    return await _callPerplexityModel(ctx, commandMessage);
  },

  async callOpenAIModel(ctx: Context, commandMessage?: string): Promise<void> {
    return await _callOpenAIModel(ctx, commandMessage);
  },

  async callCloudflareModel(ctx: Context, commandMessage?: string): Promise<void> {
    return await _callCloudflareModel(ctx, commandMessage);
  },

  async callBlackboxModel(ctx: Context, commandMessage?: string): Promise<void> {
    return await _callBlackboxModel(ctx, commandMessage);
  }
}

async function _callPerplexityModel(ctx: Context, commandMessage?: string): Promise<void> {
  const { userKey, contextMessage, photos, caption, quote } = await ctx.extractContextKeys();

  const message = commandMessage || contextMessage;

  if (photos && caption) {
    if (photos && caption) {
      ctx.replyWithVisionNotSupportedByModel();
      return;
    }
  }

  const command = message!.split(':')[0]
    .replace(/^search$/si, 'perplexity')
    .replace(/^reasonSearch$/si, 'perplexityReasoning')
    .toLowerCase();

  const model = `/${command}` as '/perplexity' | '/perplexityreasoning';

  const openAIService = new OpenAiService(model);

  const { reader, onComplete, responseMap } = await openAIService.generateText(userKey, quote, message!.replace('perplexity:', ''));
  ctx.streamReply(reader, onComplete, responseMap);
}

async function _callOpenAIModel(ctx: Context, commandMessage?: string): Promise<void> {
  const { userKey, contextMessage, photos, caption, quote } = await ctx.extractContextKeys();
  const openAIService = new OpenAiService('/openai');

  if (photos && caption) {
    const photosUrl = getTelegramFilesUrl(ctx, photos);
    const { reader, onComplete, responseMap } = await openAIService.generateTextFromImage(userKey, quote, photosUrl, caption);
    ctx.streamReply(reader, onComplete, responseMap);
    return;
  }

  const message = commandMessage || contextMessage;

  const command = message!.split(':')[0].toLowerCase();

  switch (command) {
    case 'gpt': {
        const { reader, onComplete, responseMap }  = await new OpenAiService('/github').generateText(userKey, quote, message!.replace('gpt:', ''));
        ctx.streamReply(reader, onComplete, responseMap);
        break;
    }
    case 'gptimage': {
        const output = await openAIService.generateImage(userKey, message!.replace('gptImage:', ''));
        const mediaUrls = output.map(imageUrl => InputMediaBuilder.photo(imageUrl));
        ctx.replyWithMediaGroup(mediaUrls, { reply_to_message_id: ctx.message?.message_id });
        return;
    }
  }
}

async function _callCloudflareModel(ctx: Context, commandMessage?: string): Promise<void> {
  const { userKey, contextMessage, photos, caption, quote } = await ctx.extractContextKeys();

  if (photos && caption) {
    const photoUrl = getTelegramFilesUrl(ctx, photos)[0];
    const output = await CloudFlareService.generateTextFromImage(userKey, quote, photoUrl, caption);
    ctx.replyInChunks(output);
    return;
  }

  const message = commandMessage || contextMessage;

  const cloudflareCommand = message!.split(':')[0].toLowerCase();

  switch (cloudflareCommand) {
    case 'llama':{
      const { reader, onComplete, responseMap } = await CloudFlareService.generateText(userKey, quote, message!.replace('llama:', ''));
      ctx.streamReply(reader, onComplete, responseMap);
      return;
    }
    case 'sql':{
      const { reader, onComplete, responseMap } = await CloudFlareService.generateSQL(userKey, quote, message!.replace('sql:', ''));
      ctx.streamReply(reader, onComplete, responseMap);
      return;
    }
    case 'code':{
      const { reader, onComplete, responseMap } = await CloudFlareService.generateCode(userKey, quote, message!.replace('code:', ''));
      ctx.streamReply(reader, onComplete, responseMap);
      return;
    }
    case 'cloudflareimage':
      ctx.replyWithPhoto(new InputFile(new Uint8Array(await CloudFlareService.generateImage(message!)), 'image/png'), { reply_to_message_id: ctx.message?.message_id });
      return;
  }
}

async function _callBlackboxModel(ctx: Context, commandMessage?: string): Promise<void> {
  const { userKey, contextMessage, photos, caption, quote } = await ctx.extractContextKeys();

  if (photos && caption) {
    ctx.replyWithVisionNotSupportedByModel();
    return;
  }
  
  const message = commandMessage || contextMessage;

  const blackBoxCommand = message!.split(':')[0].toLowerCase();

  switch(blackBoxCommand) {
    case 'deepseek':
    case 'blackbox':{
      const { reader, onComplete } = await BlackboxaiService.generateText(userKey, quote, 
        message!.replace('blackbox:', '').replace('deepseek:', ''));
      ctx.streamReply(reader, onComplete);
      return;
    }
    case 'r1':{
      const { reader, onComplete } = await BlackboxaiService.generateReasoningText(userKey, quote, message!.replace('r1:', ''));
      ctx.streamReply(reader, onComplete);
      return;
    }
    case 'image': {
      const imageUrl = await BlackboxaiService.generateImage(message!.replace('image:', ''));
      ctx.replyWithPhoto(imageUrl, { reply_to_message_id: ctx.message?.message_id });
      return;
    }
  }
}

async function _callGeminiModel(ctx: Context): Promise<void> {
  const { userKey, contextMessage: message, photos, caption, quote } = await ctx.extractContextKeys();
  
  if (await setUserGeminiApiKeysIfAbsent(userKey, message)) {
    ctx.reply('Chave API do Gemini salva com sucesso!', { reply_to_message_id: ctx.message?.message_id });
    return;
  }

  try {
    const geminiService = await GeminiService.of(userKey);
    const outputMessage = await getGeminiOutput(geminiService, ctx, message, quote, photos, caption);
    ctx.replyInChunks(outputMessage);
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
    const photosUrl = getTelegramFilesUrl(ctx, photos);
    return await geminiService.sendPhotoMessage(quote, photosUrl, caption);
  } else {
    return 'Não entendi o que você quer, me envie uma mensagem de texto ou foto com legenda.';
  }
}

function getTelegramFilesUrl(ctx: Context, photos: PhotoSize[] | Audio[]): Promise<string>[] {
  return photos.map(async photo => {
    const file = await ctx.api.getFile(photo.file_id);
    const url = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
    return url;
  })
}

export async function downloadTelegramFile(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  return new Uint8Array(await response.arrayBuffer());
}

export async function transcribeAudio(userId: number, userKey: string, ctx: Context, audio: Voice): Promise<string> {
  const audioUrl: string = await getTelegramFilesUrl(ctx, [audio])[0];
  const isGptModelCommand = gptModelCommand === await getCurrentModel(userKey);

  const audioFile: Promise<Uint8Array> = downloadTelegramFile(audioUrl);

  const output = isGptModelCommand || ADMIN_USER_IDS.includes(userId)
    ? await new OpenAiService('/openai').transcribeAudio(audioFile, audioUrl) 
    : await CloudFlareService.transcribeAudio(audioFile);
  
  return output;
}

function keepDenoJobAlive(): number {
  return setInterval(() => true, 2000);
}