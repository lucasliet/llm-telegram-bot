import { Application } from 'https://deno.land/x/oak@v12.6.1/mod.ts';
import { oakCors } from 'https://deno.land/x/cors@v1.2.2/mod.ts';

import { Bot, webhookCallback } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';
import TelegramService from './service/TelegramService.ts';
import { clearChatHistory, modelCommands } from './repository/ChatRepository.ts';

import './prototype/StringExtensionPrototype.ts';

const TOKEN: string = Deno.env.get('BOT_TOKEN') as string;
const PORT: number = parseInt(Deno.env.get('PORT') as string) || 80;

const BOT = new Bot(TOKEN);
const APP = new Application();

APP.use(oakCors());

Deno.cron("Configure Telegram bot webhook", "0 0 * * *", async () => {
  await TelegramService.setWebhook();
});

BOT.command('start', (ctx) =>
  ctx.reply(
    'Olá, me envie a chave API do Gemini, ex: `key:123456`' +
    'para conseguir a chave acesse https://aistudio.google.com/app/apikey?hl=pt-br, ' +
    'mais informações em http://github.com/lucasliet/llm-telegram-bot'
  )
);

BOT.command('clear', async (ctx) => {
  const userId = ctx.msg.from?.id;
  const userKey = `user:${userId}`;
  await clearChatHistory(userKey);
  await ctx.reply('Histórico de conversa apagado com sucesso!');
});

BOT.hears(/\/help/g, (ctx) => {
  ctx.reply(
    `Comandos disponíveis:
    /gpt - Configura modelo de linguagem para o GPT
    /llama - Configura modelo de linguagem para o Llama
    /gemini - Configura modelo de linguagem para o Gemini
    /perplexity - Configura modelo de linguagem para o modelo perplexity.ai
    /clear - Apaga o histórico de conversa
    Comandos inline:
    image: mensagem - Gera imagens com Stable Diffusion
    gptImage: mensagem - Gera imagens com DALL-e
    gpt: mensagem - Gera texto com GPT
    llama: mensagem - Gera texto com o Llama
    sql: mensagem - Gera sql com modelo cloudflare
    code: mensagem - Gera código com modelo cloudflare
    perplexity: mensagem - Faz uma pergunta usando o modelo perplexity.ai
    search: mensagem - Faz uma pergunta usando o modelo perplexity.ai
    `
  );
});

BOT.hears(/^(llama|sql|code|image):/g, async (ctx) => await TelegramService.callAdminModel(ctx, TelegramService.callCloudflareModel));

BOT.hears(/^(perplexity|search):/g, async (ctx) => await TelegramService.callAdminModel(ctx, TelegramService.callPerplexityModel));

BOT.hears(/^(gpt|gptImage):/g, async (ctx) => await TelegramService.callAdminModel(ctx, TelegramService.callOpenAIModel));

BOT.hears(new RegExp(`^(${modelCommands.join('|')})$`) , async (ctx) => await TelegramService.setCurrentModel(ctx));

BOT.on('message', async (ctx) => await TelegramService.callModel(ctx, TelegramService.replyTextContent));

APP.use(oakCors());

APP.use(async (ctx, next) => {
  try {
    if (ctx.request.url.pathname !== '/webhook') {
      ctx.response.status = 200;
      ctx.response.body = 'Use with https://t.me/llm_gemini_bot';
      return;
    }
    await next();
  } catch (err) {
    ctx.response.status = 500;
    ctx.response.body = { message: err.message };
  }
});

APP.use(webhookCallback(BOT, 'oak'));

APP.listen({ port: PORT });