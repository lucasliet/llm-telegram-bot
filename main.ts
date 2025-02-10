import { Application } from 'https://deno.land/x/oak@v12.6.1/mod.ts';
import { oakCors } from 'https://deno.land/x/cors@v1.2.2/mod.ts';

import { Bot, webhookCallback } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';
import TelegramService from './service/TelegramService.ts';
import { clearChatHistory, modelCommands } from './repository/ChatRepository.ts';

import './prototype/StringExtensionPrototype.ts';
import './prototype/ContextExtensionPrototype.ts';

const TOKEN: string = Deno.env.get('BOT_TOKEN') as string;
const PORT: number = parseInt(Deno.env.get('PORT') as string) || 3333;

const BOT = new Bot(TOKEN);
const APP = new Application();

APP.use(oakCors());

BOT.command('start', (ctx) => ctx.reply('Olá, me envie uma mensagem para começarmos a conversar!'));

BOT.command('clear', async (ctx) => {
  const userId = ctx.msg.from?.id;
  const userKey = `user:${userId}`;
  await clearChatHistory(userKey);
  await ctx.reply('Histórico de conversa apagado com sucesso!');
});

BOT.command('help', (ctx) => ctx.reply(helpMessage, { parse_mode: 'MarkdownV2' }));

BOT.command('currentModel', async (ctx) => ctx.reply(`Modelo atual: ${await TelegramService.getCurrentModel(ctx)}`));

BOT.hears(/^(llama|sql|code|cloudflareImage):/gi, (ctx) => TelegramService.callAdminModel(ctx, TelegramService.callCloudflareModel));

BOT.hears(/^(perplexity|reasonSearch|search):/gi, (ctx) => TelegramService.callAdminModel(ctx, TelegramService.callPerplexityModel));

BOT.hears(/^(gpt|gptImage):/gi, (ctx) => TelegramService.callAdminModel(ctx, TelegramService.callOpenAIModel));

BOT.hears(/^(blackbox|deepseek|r1|image):/gi, (ctx) => TelegramService.callAdminModel(ctx, TelegramService.callBlackboxModel));

BOT.hears(new RegExp(`^(${modelCommands.join('|')})$`) , async (ctx) => await TelegramService.setCurrentModel(ctx));

BOT.on('message', (ctx) => TelegramService.callModel(ctx, TelegramService.replyTextContent));

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

if(Deno.env.get('DENO_DEPLOYMENT_ID')) {
  Deno.cron("Configure Telegram bot webhook", "0 0 * * *", async () => {
    await TelegramService.setWebhook();
  });
  
  APP.use(webhookCallback(BOT, 'oak'));
  
  APP.listen({ port: PORT });
} else {
  BOT.start();
}

const helpMessage = `*Comandos disponíveis*:
/currentModel \\- Mostra o modelo de linguagem selecionado atualmente
/gpt \\- Configura modelo de linguagem para o __GPT__
/llama \\- Configura modelo de linguagem para o __Llama__
/gemini \\- Configura modelo de linguagem para o __Gemini__
/perplexity \\- Configura modelo de linguagem para o modelo perplexity\\.ai
/perplexityReasoning \\- Configura modelo de linguagem para o modelo perplexity\\.ai usando __Deepseek\\-R1__
/blackbox \\- Configura modelo de linguagem para o __Deepseek\\-V3__ pela __BlackboxAI__
/r1 \\- Configura modelo de linguagem para o __Deepseek\\-R1__ pela __BlackboxAI__
/clear \\- Apaga o histórico de conversa

*Comandos inline*:
\\- \`cloudflareImage\`: mensagem \\- Gera imagens com __Stable Diffusion__
\\- \`image\`: mensagem \\- Gera imagens com __Flux\\.1__
\\- \`gptImage\`: mensagem \\- Gera imagens com __DALL\\-e__
\\- \`gpt\`: mensagem \\- Gera texto com __GPT__
\\- \`llama\`: mensagem \\- Gera texto com o __Llama__
\\- \`sql\`: mensagem \\- Gera sql com modelo __cloudflare__
\\- \`code\`: mensagem \\- Gera código com modelo __cloudflare__
\\- \`perplexity\`: mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai
\\- \`search\`: mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai
\\- \`reasonSearch\`: mensagem \\- Faz uma pergunta usando o modelo perplexity\\.ai com o uso de __Deepseek\\-R1__
\\- \`blackbox\`: mensagem \\- Faz uma pergunta usando o modelo __Deepseek\\-V3__ pela __BlackboxAI__
\\- \`deepseek\`: mensagem \\- Faz uma pergunta usando o modelo __Deepseek\\-V3__ pela __BlackboxAI__
\\- \`r1\`: mensagem \\- Faz uma pergunta usando o modelo __Deepseek\\-R1__ pela __BlackboxAI__`;