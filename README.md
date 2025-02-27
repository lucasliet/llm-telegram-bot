[![Coverage Status](https://coveralls.io/repos/github/lucasliet/llm-telegram-bot/badge.svg?branch=main)](https://coveralls.io/github/lucasliet/llm-telegram-bot?branch=main)
# Instruções

acesse o bot via telegram [@llm_gemini_bot](https://t.me/llm_gemini_bot)

esse bot utiliza o modelo gratuito Deepseek-V3 da
[BlackboxAI](https://www.blackbox.ai/) para responder as mensagens por padrão,
para uso dos outros modelos é necessário implantar código no seu
[próprio bot](https://core.telegram.org/bots/tutorial), rodando localmente ou em
um servidor, e configurando o seu ID do telegram como a variavel ambiente
`ADMIN_USER_IDS`

um histórico da conversa é mantido para mensagens encadiadas, porém com
expiração de 1 dia após a ultima mensagem, também pode ser apagado manualmente
com o commando `/clear`

esse projeto utiliza o [Deno deploy](https://deno.com/deploy) e
[Deno kv](https://deno.com/kv) para hosting da aplicação e armazenamento
persistente de chaves

## Uso Local

- um script para execução local da aplicação está disponível em
  [devrun.sh](./devrun.sh), esse script já configura as variaveis de ambiente
  necessárias e executa o comando `curl` em seguida para configurar novamente o
  bot para uso por servidor, caso o deno não esteja instalado, será executado
  seu script de instalação

- variáveis de ambiente necessárias para execução local:
  - `SERVER_URL` - url do servidor em que esse código está rodando, exemplo:
    `https://seu-servidor.com/webhook`
  - `BOT_TOKEN` - token do bot criado pelo [@BotFather](https://t.me/BotFather)
  - `ADMIN_USER_IDS` -
    [id do seu usuário no telegram](https://core.telegram.org/api/bots/ids#user-ids),
    para uso dos modelos pagos, aceito lista no formato `123456789|987654321`
- variaveis opcionais, para uso dos diferentes modelos de linguagem:
  - `CLOUDFLARE_API_KEY` - api key da
    [Cloudflare](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
    para uso do modelo gratuito
  - `CLOUDFLARE_ACCOUNT_ID` - id da conta da
    [Cloudflare](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
    para uso do modelo gratuito
  - `GITHUB_TOKEN` - token do
    [Github](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
    para uso do modelo gpt gratuitamente
  - `OPENAI_API_KEY` - api key da [OpenAI](https://platform.openai.com/api-keys)
    para uso do modelo pago
  - `PERPLEXITY_API_KEY` - api key da
    [Perplexity](https://docs.perplexity.ai/guides/getting-started) para uso do
    modelo pago
  - `GEMINI_API_KEY` - api key da
    [Google](https://aistudio.google.com/app/apikey?hl=pt-br) para uso do modelo
    pago

- crie um arquivo .env na raiz do projeto e configure as variaveis de ambiente
  nele, no formato `VARIAVEL=valor`
  ```bash
  ./devrun.sh
  ```

## Testes

Este projeto inclui um conjunto abrangente de testes automatizados para garantir
a qualidade e estabilidade do código.

### Executando testes

Para executar todos os testes:

```bash
deno task test
```

Para executar um teste específico:

```bash
deno test -A --unstable-kv --unstable-cron tests/service/TelegramService.test.ts
```

### Estrutura de testes

Os testes estão organizados na pasta `tests/` e seguem a mesma estrutura do
código:

- `tests/service/` - Testes para os serviços que interagem com APIs externas
- `tests/repository/` - Testes para o acesso e armazenamento de dados
- `tests/handlers/` - Testes para os handlers que processam comandos específicos

Para mais informações sobre os testes, consulte o
[README dos testes](./tests/README.md).

### Integração Contínua

Este projeto utiliza GitHub Actions para executar testes automaticamente em cada
push para a branch `main` e em pull requests. O workflow está configurado em
`.github/workflows/tests.yml`.

Para verificar o status das execuções de CI, consulte a aba "Actions" no
repositório do GitHub.
