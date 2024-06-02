# Instruções

acesse o bot via telegram [@llm_gemini_bot](https://t.me/llm_gemini_bot)

a primeira mensagem que deve ser enviada ao boot após o /start é a sua chave de API do Gemini, no formato `key:<SUA-CHAVE>`
> ℹ️ na data de hoje o Gemini possui free tier para acesso gratuito de sua API com limitação de uso diário ref: https://ai.google.dev/pricing?hl=pt-br

por ora esse bot utiliza somente o modelo `gemini-1.5-flash` que é o mais barato dos disponiveis, e trabalha somente com mensagens de texto

um histórico da conversa é mantido para mensagens encadiadas, porém com expiração de 1 dia após a ultima mensagem

esse projeto utiliza o [Deno deploy](https://deno.com/deploy) e [Deno kv](https://deno.com/kv) para hosting da aplicação e armazenamento persistente de chaves

## Uso Local

- para execução da aplicação localmente é necessário ter o [Deno](https://deno.land/) instalado, e o token provisionado pelo [@BotFather](https://t.me/BotFather) na criação do bot no telegram configurado na variavel ambiente `BOT_TOKEN`
  ```bash
  BOT_TOKEN=<TOKEN> deno run --allow-env --allow-net --allow-read --unstable main.ts  
  ```
  opcionalmente pode-se usar o `denon` para facilitar o desenvolvimento com live-reload
  - install
  ```bash
  deno install -qAf --unstable https://deno.land/x/denon/denon.ts
  ```
  - run
  ```bash
  BOT_TOKEN=<TOKEN> deno run --allow-env --allow-net --allow-read --unstable main.ts  
  ```
- substituia a ultima linha do arquivo [main.ts](./main.ts) para rodar localmente
  ```ts
  APP.listen({ port: PORT });
  ```
  para
  ```ts
  BOT.start();
  ```