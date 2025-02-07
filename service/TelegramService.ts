import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import { ModelCommand, setCurrentModel, getCurrentModel, setUserGeminiApiKeysIfAbsent, //
  gptModelCommand, llamaModelCommand, geminiModelCommand, perplexityModelCommand, 
  blackboxModelCommand, blackboxReasoningModelCommand, 
  getTranscribedAudio,
  cacheTranscribedAudio} from '../repository/ChatRepository.ts';
import GeminiService from './GeminiService.ts';
import CloudFlareService from './CloudFlareService.ts';
import OpenAiService from './OpenAIService.ts';
import { ApiKeyNotFoundError } from '../error/ApiKeyNotFoundError.ts';
import { Audio, InputFile, PhotoSize, Voice } from 'https://deno.land/x/grammy@v1.17.2/types.deno.ts';
import { InputMediaBuilder } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';
import BlackboxaiService from './BlackboxaiService.ts';

const TOKEN = Deno.env.get('BOT_TOKEN') as string;
const ADMIN_USER_IDS: number[] = (Deno.env.get('ADMIN_USER_IDS') as string).split('|').map(parseInt);
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
    const timeoutId = replyOnLongAnswer(ctx);

    modelCallFunction(ctx).then(() => {
      clearTimeout(timeoutId);
      clearInterval(keepAliveId);
      console.log(`Request processed in ${Date.now() - startTime}ms`);
    }).catch((err) => {
      console.error(err);
      ctx.reply(`Eita, algo deu errado: ${err.message}`,
        { reply_to_message_id: ctx.msg?.message_id })
    });
  },

  async setCurrentModel(ctx: Context): Promise<void> {
    console.info(`user: ${ctx.msg?.from?.id}, message: ${ctx.message?.text}`);
    const {userId, userKey, contextMessage: message} = await extractContextKeys(ctx);

    if (!ADMIN_USER_IDS.includes(userId!) && !WHITELISTED_MODELS.includes(message as ModelCommand)) return;
    
    await setCurrentModel(userKey, message as ModelCommand);
    ctx.reply(`Novo modelo de inteligência escolhido: ${message}`);
  },

  async replyTextContent(ctx: Context): Promise<void> {
    const { userKey, contextMessage: message } = await extractContextKeys(ctx);
    
    switch (await getCurrentModel(userKey)) {
      case gptModelCommand:
        await _callOpenAIModel(ctx,`gpt: ${message}`);
        return;
      case perplexityModelCommand:
        await _callPerplexityModel(ctx,`perplexity: ${message}`);
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
        await callGeminiModel(ctx);
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
  const { userKey, contextMessage, photos, caption, quote } = await extractContextKeys(ctx);
  
  const message = commandMessage || contextMessage;

  const openAIService = new OpenAiService('/perplexity');

  if (photos && caption) {
    const photosUrl = getTelegramFilesUrl(ctx, photos);
    const output = await openAIService.generateTextFromImage(userKey, quote, photosUrl, caption);
    replyInChunks(ctx, output);
    return;
  }
  
  const output = await openAIService.generateText(userKey, quote, message!.replace('perplexity:', ''));
  replyInChunks(ctx, output);
  return;
}

async function _callOpenAIModel(ctx: Context, commandMessage?: string): Promise<void> {
  const { userKey, contextMessage, photos, caption, quote } = await extractContextKeys(ctx);
  const openAIService = new OpenAiService('/openai');

  if (photos && caption) {
    const photosUrl = getTelegramFilesUrl(ctx, photos);
    const output = await openAIService.generateTextFromImage(userKey, quote, photosUrl, caption);
    replyInChunks(ctx, output);
    return;
  }

  const message = commandMessage || contextMessage;

  const command = message!.split(':')[0];

  switch (command) {
    case 'Gpt':
    case 'gpt': {
        const output = await new OpenAiService('/github').generateText(userKey, quote, message!.replace('gpt:', ''));
        replyInChunks(ctx, output);
        break;
    }
    case 'GptImage':
    case 'gptImage': {
        const output = await openAIService.generateImage(userKey, message!.replace('gptImage:', ''));
        const mediaUrls = output.map(imageUrl => InputMediaBuilder.photo(imageUrl));
        ctx.replyWithMediaGroup(mediaUrls, { reply_to_message_id: ctx.message?.message_id });
        return;
    }
  }
}

async function _callCloudflareModel(ctx: Context, commandMessage?: string): Promise<void> {
  const { userKey, contextMessage, photos, caption, quote } = await extractContextKeys(ctx);

  if (photos && caption) {
    const photoUrl = getTelegramFilesUrl(ctx, photos)[0];
    const output = await CloudFlareService.generateTextFromImage(userKey, quote, photoUrl, caption);
    replyInChunks(ctx, output);
    return;
  }

  const message = commandMessage || contextMessage;

  const cloudflareCommand = message!.split(':')[0];
  let output = ''
  switch (cloudflareCommand) {
    case 'Llama':
    case 'llama':
      output = await CloudFlareService.generateText(userKey, quote, message!.replace('llama:', ''));
      break;
    case 'Sql':
    case 'sql':
      output = await CloudFlareService.generateSQL(userKey, quote, message!.replace('sql:', ''));
      break;
    case 'Code':
    case 'code':
      output = await CloudFlareService.generateCode(userKey, quote, message!.replace('code:', ''));
      break;
    case 'CloudflareImage':
    case 'cloudflareImage':
      ctx.replyWithPhoto(new InputFile(new Uint8Array(await CloudFlareService.generateImage(message!)), 'image/png'), { reply_to_message_id: ctx.message?.message_id });
      return;
  }
  replyInChunks(ctx, output);
}

async function _callBlackboxModel(ctx: Context, commandMessage?: string): Promise<void> {
  const { userKey, contextMessage, photos, caption, quote } = await extractContextKeys(ctx);

  if (photos && caption) {
    ctx.reply("esse modelo não suporta leitura de foto", { reply_to_message_id: ctx.message?.message_id });
    return;
  }
  
  const message = commandMessage || contextMessage;

  const blackBoxCommand = message!.split(':')[0];

  let output = '';
  switch(blackBoxCommand) {
    case 'Deepseek':
    case 'deepseek':
    case 'Blackbox':
    case 'blackbox':
      output = await BlackboxaiService.generateText(userKey, quote, 
        message!.replace('blackbox:', '').replace('deepseek:', ''));
      break;
    case 'R1': 
    case 'r1':
      output = await BlackboxaiService.generateReasoningText(userKey, quote, message!.replace('r1:', ''));
      break;
    case 'Image':
    case 'image': {
      const imageUrl = await BlackboxaiService.generateImage(message!.replace('image:', ''));
      ctx.replyWithPhoto(imageUrl, { reply_to_message_id: ctx.message?.message_id });
      return;
    }
  }

  replyInChunks(ctx, output);
}

async function callGeminiModel(ctx: Context): Promise<void> {
  const { userKey, contextMessage: message, photos, caption, quote } = await extractContextKeys(ctx);
  
  if (await setUserGeminiApiKeysIfAbsent(userKey, message)) {
    ctx.reply('Chave API do Gemini salva com sucesso!', { reply_to_message_id: ctx.message?.message_id });
    return;
  }

  try {
    const geminiService = await GeminiService.of(userKey);
    const outputMessage = await getGeminiOutput(geminiService, ctx, message, quote, photos, caption);
    replyInChunks(ctx, outputMessage);
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

async function transcribeAudio(userKey: string, ctx: Context, audio: Voice): Promise<string> {
  const audioUrl: string = await getTelegramFilesUrl(ctx, [audio])[0];
  const isGptModelCommand = gptModelCommand === await getCurrentModel(userKey);
  const cacheKey: string[] = [userKey, audioUrl, `${isGptModelCommand}`];

  const cachedTranscribedAudio = await getTranscribedAudio(cacheKey);

  if (cachedTranscribedAudio) {
    return cachedTranscribedAudio;
  }
  
  const audioFile: Promise<Uint8Array> = downloadTelegramFile(audioUrl);

  const output = isGptModelCommand 
    ? await new OpenAiService('/openai').transcribeAudio(audioFile, audioUrl) 
    : await CloudFlareService.transcribeAudio(audioFile);
  
  await cacheTranscribedAudio(cacheKey, output);
  return output;
}

function getTextMessage(userKey: string, ctx: Context, audio?: Voice): Promise<string | undefined> {
  return audio ? transcribeAudio(userKey, ctx, audio) : Promise.resolve(ctx.message?.text);
}

async function extractContextKeys(ctx: Context) {
  const userId = ctx.from?.id;
  const userKey = `user:${userId}`;
  const audio = ctx.message?.voice || ctx.message?.audio;
  const contextMessage = await getTextMessage(userKey, ctx, audio);
  const photos = ctx.message?.photo;
  const caption = ctx.message?.caption;
  const quote = ctx.message?.reply_to_message?.text;
  return { userId, userKey, contextMessage, audio, photos, caption, quote };
}

function replyOnLongAnswer(ctx: Context): number {
  return setTimeout(() => {
    console.info('Request is longing too much, replying processing message...');
    ctx.reply(
      'Estou processando sua solicitação, aguarde um momento...', 
      { reply_to_message_id: ctx.message?.message_id }
    );
  }, 6000);
}

function keepDenoJobAlive(): number {
  return setInterval(() => true, 2000);
}

function replyInChunks(ctx: Context, output: string): void {
  if(output.length > 4096) {
    const outputChunks = output.match(/[\s\S]{1,4096}/g)!;
    outputChunks.forEach((chunk, index) => ctx.reply(`${chunk}${index === outputChunks.length ? '' : '...'}`, { reply_to_message_id: ctx.message?.message_id }));
    return;
  }

  ctx.reply(output, { reply_to_message_id: ctx.message?.message_id });
}