import { Application } from 'https://deno.land/x/oak@v12.6.1/mod.ts';
import { oakCors } from 'https://deno.land/x/cors@v1.2.2/mod.ts';

import { Bot, webhookCallback } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';
import { replyTextContent } from './service/TelegramService.ts';

const TOKEN: string = Deno.env.get('BOT_TOKEN') as string;
const PORT: number = parseInt(Deno.env.get('PORT') as string) || 80;

const BOT = new Bot(TOKEN);
const APP = new Application();

APP.use(oakCors());

BOT.command('start', (ctx) =>
  ctx.reply(
    'Olá, me envie a chave API do Gemini, ex: `key:123456`' +
    'para conseguir a chave acesse https://aistudio.google.com/app/apikey?hl=pt-br, ' +
    'mais informações em http://github.com/lucasliet/gemini-telegram-bot'
  )
);

BOT.on('message', async (ctx) => {
  console.info(`user: ${ctx.msg.from?.id}, message: ${ctx.message?.text}`);
  try {
    await replyTextContent(ctx);
  } catch (err) {
    await ctx.reply(`Eita, algo deu errado: ${err.message}`,
      { reply_to_message_id: ctx.msg.message_id })
    console.error(err);
  }
});

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