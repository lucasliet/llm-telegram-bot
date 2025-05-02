# Mudando a Fonte de um Comando para Outro Provedor

Para mudar a fonte de um comando para outro provedor disponível, siga as instruções abaixo:

1. Identifique o comando que deseja alterar e o provedor atual. Por exemplo, o comando `/gpt` pode estar usando o provedor `openai`.
2. Verifique os provedores disponíveis para o modelo desejado. Por exemplo, o modelo `gpt-4o-mini` está disponível nos provedores `openai`, `duckduckgo`, `openrouter`, `github` e `copilot`.
3. Altere o comando para usar o provedor desejado. Por exemplo, para usar o provedor `duckduckgo` com o modelo `gpt-4o-mini`, você apontar o comando existente `/gpt` para utilizar o provedor duckduckgo no `src/service/TelegramService.ts`.

## Instruções Detalhadas

### No arquivo `src/service/TelegramService.ts`:

1. Localize a função `replyTextContent` e adicione ou modifique o mapeamento do comando para o novo provedor. Por exemplo, se você deseja alterar o comando `/gpt` para usar o provedor `duckduckgo`, modifique a linha correspondente para `'/gpt': () => handleDuckDuckGo(ctx, `gpt: ${message}`)`.

### No arquivo `main.ts`:

1. Localize os comandos registrados no bot e atualize-os para usar o novo provedor. Por exemplo, se o comando inline `gpt:` estava usando o provedor `openai`, altere a linha correspondente para usar o novo provedor, como `BOT.hears(/^(gpt):/gi, (ctx) => TelegramService.callAdminModel(ctx, TelegramService.callDuckDuckGoModel));`. e remova o comando gpt do regex de onde chamava o TelegramService.callOpenAiModel

### No arquivo `src/handlers/DuckDuckGoHandler.ts`:

1. Garanta que a função `handleDuckDuckGo` mapea o comando inline `gpt:` utilizado pelo TelegramService.replyText que foi alterado para chamar o modelo desejado. (`src/handlers/GithubCopilotHandler.ts` pode ser utilizado como modelo padrão de mapeamento a seguir)

Seguindo essas instruções, você poderá alterar a fonte de um comando para outro provedor disponível no projeto.

## Caminho dos Arquivos dos Serviços Citados

- `src/service/TelegramService.ts`
- `main.ts`
- `src/handlers/DuckDuckGoHandler.ts`

## Documentação da OpenAI sobre Uso de Ferramentas

Para mais informações sobre o uso de ferramentas com a OpenAI, consulte a documentação oficial: [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling?api-mode=chat)
