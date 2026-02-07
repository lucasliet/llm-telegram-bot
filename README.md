[![Coverage Status](https://coveralls.io/repos/github/lucasliet/llm-telegram-bot/badge.svg?branch=main)](https://coveralls.io/github/lucasliet/llm-telegram-bot?branch=main)

# Instruções

acesse o bot via telegram [@llm_gemini_bot](https://t.me/llm_gemini_bot)

esse bot utiliza o modelo gratuito [Pollinations](https://pollinations.ai/) para responder as mensagens por padrão, para uso dos outros modelos é necessário
implantar código no seu [próprio bot](https://core.telegram.org/bots/tutorial), rodando localmente ou em um servidor, e configurando o seu ID do telegram como a
variavel ambiente `ADMIN_USER_IDS`

um histórico da conversa é mantido para mensagens encadiadas, porém com expiração de 1 dia após a ultima mensagem, também pode ser apagado manualmente com o
commando `/clear`

esse projeto utiliza o [Deno deploy](https://deno.com/deploy) e [Deno kv](https://deno.com/kv) para hosting da aplicação e armazenamento persistente de chaves

## Provedores e Modelos Disponíveis

| Provedor       | Comando Inline                           | Modelo                | Ferramentas |
| -------------- | ---------------------------------------- | --------------------- | ----------- |
| Pollinations   | `polli:`                                 | OpenAI                | Sim         |
| GitHub Copilot | `gpt:`                                   | GPT 5 mini            | Sim         |
| GitHub Copilot | `gpt5:`                                  | GPT 5.2               | Sim         |
| GitHub Copilot | `claude:`                                | Claude Sonnet 4.5     | Sim         |
| GitHub Copilot | `geminiPro:`                             | Gemini 3 Pro Preview  | Sim         |
| Cloudflare     | `oss:`                                   | GPT OSS 120b          | Nao         |
| OpenRouter     | `llama:`                                 | Llama 4 Maverick      | Sim         |
| Vertex AI      | `gemini:`                                | Gemini 2.5 Flash Lite | Sim         |
| Vertex AI      | `geminiPro:`                             | Gemini 2.5 Pro        | Sim         |
| Perplexity     | `perplexity:` / `search:`                | Sonar                 | Nao         |
| Perplexity     | `reasonSearch:`                          | Sonar Reasoning Pro   | Nao         |
| OpenWebUI      | `pgpt:` / `pgrok:` / `po3:` / `pclaude:` | PPLX models           | Nao         |
| Antigravity    | `antigravity:` / `antigemini:`           | Gemini 3 Flash        | Sim         |
| Antigravity    | `anticlaude:`                            | Claude Sonnet 4.5     | Sim         |
| DALL-E         | `gptImage:`                              | DALL-E 3              | -           |
| Cloudflare     | `cloudflareImage:`                       | Stable Diffusion      | -           |
| Pollinations   | `polliImage:`                            | Pollinations          | -           |
| Arta           | `artaImage:`                             | Arta                  | -           |
| ElevenLabs     | `fala:`                                  | TTS                   | -           |

## Uso Local

- um script para execução local da aplicação está disponível em [devrun.sh](./devrun.sh), esse script já configura as variaveis de ambiente necessárias e
  executa o comando `curl` em seguida para configurar novamente o bot para uso por servidor, caso o deno não esteja instalado, será executado seu script de
  instalação

- variáveis de ambiente necessárias para execução local:
  - `SERVER_URL` - url do servidor em que esse código está rodando, exemplo: `https://seu-servidor.com/webhook`
  - `BOT_TOKEN` - token do bot criado pelo [@BotFather](https://t.me/BotFather)
  - `ADMIN_USER_IDS` - [id do seu usuário no telegram](https://core.telegram.org/api/bots/ids#user-ids), para uso dos modelos pagos, aceito lista no formato
    `123456789|987654321`
- variaveis opcionais, para uso dos diferentes modelos de linguagem:
  - `CLOUDFLARE_API_KEY` - api key da [Cloudflare](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) para uso do modelo gratuito
  - `CLOUDFLARE_ACCOUNT_ID` - id da conta da [Cloudflare](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) para uso do modelo gratuito
  - `GITHUB_TOKEN` - token do [Github](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) para
    uso do modelo gpt gratuitamente
  - `OPENAI_API_KEY` - api key da [OpenAI](https://platform.openai.com/api-keys) para uso do modelo pago
  - `PERPLEXITY_API_KEY` - api key da [Perplexity](https://docs.perplexity.ai/guides/getting-started) para uso do modelo pago
  - `GEMINI_API_KEY` - api key da [Google](https://aistudio.google.com/app/apikey?hl=pt-br) para uso do modelo pago
  - `OPENROUTER_API_KEY` - api key da [OpenRouter](https://openrouter.ai/settings/keys) para uso do modelo pago
  - `COPILOT_GITHUB_TOKEN` - token do [Copilot](https://github.com/features/copilot) para uso do modelo pago. Para obter o token, configure a extensão do
    Copilot no VSCode e extraia o token do arquivo `~/.config/github-copilot/apps.json`.
  - `VERTEX_CREDENTIALS_BASE64` - credenciais do [Vertex AI](https://cloud.google.com/vertex-ai) em base64 (service account ou ADC)
  - `VERTEX_PROJECT_ID` - ID do projeto GCP para o Vertex AI
  - `VERTEX_LOCATION` - região do Vertex AI (padrão: `us-central1`)
  - `OPENWEBUI_API_KEY` - api key do [OpenWebUI](https://openwebui.com/)
  - `ANTIGRAVITY_REFRESH_TOKEN` - refresh token OAuth2 para o provider Antigravity (ver seção abaixo)
  - `ANTIGRAVITY_PROJECT_ID` - (opcional) ID do projeto Cloud AI Companion, descoberto automaticamente se não configurado

- crie um arquivo .env na raiz do projeto e configure as variaveis de ambiente nele, no formato `VARIAVEL=valor`
  ```bash
  ./devrun.sh
  ```

## Configuração do Provider Antigravity

O provider Antigravity permite acesso aos modelos Gemini 3 Flash e Claude Sonnet 4.5 via a API Cloud Code. Para configurar:

### 1. Obter o Refresh Token

Execute o fluxo OAuth2 para obter o refresh token. O fluxo utiliza o client ID do Gemini Code Assist:

```bash
# 1. Abra a URL abaixo no navegador para autorizar:
https://accounts.google.com/o/oauth2/auth?client_id=1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com&redirect_uri=http://localhost:9004&response_type=code&scope=https://www.googleapis.com/auth/cloud-platform%20https://www.googleapis.com/auth/userinfo.email%20https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/cclog%20https://www.googleapis.com/auth/experimentsandconfigs&access_type=offline&prompt=consent

# 2. Após autorizar, copie o 'code' da URL de callback e troque por tokens:
curl -s -X POST https://oauth2.googleapis.com/token \
  -d "client_id=1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com" \
  -d "client_secret=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" \
  -d "code=SEU_CODE_AQUI" \
  -d "redirect_uri=http://localhost:9004" \
  -d "grant_type=authorization_code" | python3 -m json.tool

# 3. Da resposta JSON, copie o valor de 'refresh_token'
```

### 2. Configurar variáveis de ambiente

```bash
# Adicione ao .env ou configure no Deno Deploy:
ANTIGRAVITY_REFRESH_TOKEN=1//SEU_REFRESH_TOKEN_AQUI
# Opcional - será descoberto automaticamente:
ANTIGRAVITY_PROJECT_ID=seu-project-id
```

O access token é renovado automaticamente (válido por ~1h). O project ID é descoberto via API se não configurado.

Para detalhes sobre a arquitetura, thought signatures e o ciclo de tool calls do Antigravity, consulte o arquivo [ANTIGRAVITY.md](./.github/ANTIGRAVITY.md).

## Mudando a Fonte de um Modelo para Outro Provedor

Para mudar a fonte de um modelo para outro provedor disponível, consulte o arquivo [CHANGE_PROVIDER.md](./.github/CHANGE_PROVIDER.md).

## Uso de Ferramentas com Provedores Compatíveis com OpenAI

Provedores compatíveis com OpenAI que estendem a classe `openai` e suportam o uso de ferramentas podem utilizar o `searxng` para obter respostas atualizadas.
Para mais informações, consulte o arquivo [TOOL_USAGE.md](./.github/TOOL_USAGE.md).

## Testes

Este projeto inclui um conjunto abrangente de testes automatizados para garantir a qualidade e estabilidade do código.

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

Os testes estão organizados na pasta `tests/` e seguem a mesma estrutura do código:

- `tests/service/` - Testes para os serviços que interagem com APIs externas
- `tests/repository/` - Testes para o acesso e armazenamento de dados
- `tests/handlers/` - Testes para os handlers que processam comandos específicos

Para mais informações sobre os testes, consulte o [README dos testes](./tests/README.md).

### Integração Contínua

Este projeto utiliza GitHub Actions para executar testes automaticamente em cada push para a branch `main` e em pull requests. O workflow está configurado em
`.github/workflows/tests.yml`.

Para verificar o status das execuções de CI, consulte a aba "Actions" no repositório do GitHub.
