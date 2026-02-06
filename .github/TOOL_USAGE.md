# Uso de Ferramentas com Provedores Compatíveis com OpenAI

Provedores compatíveis com OpenAI que estendem a classe `openai` e suportam o uso de ferramentas podem utilizar o `searxng` para obter respostas atualizadas. Abaixo estão as instruções para configurar e utilizar essa funcionalidade.

## Utilização

1. Envie uma mensagem para o bot especificando o provedor e o modelo que deseja utilizar. Por exemplo:
`duckgo: quanto está o dolar hoje?`

2. O bot utilizará o `searxng` para obter respostas atualizadas e retornará a resposta para você.

## Exemplos de Provedores que Suportam o Uso de Ferramentas no projeto

- Copilot Service `src/service/openai/GithubCopilotService.ts`
- OpenRouter Service `src/service/openai/OpenrouterService.ts`
- GitHub Service `src/service/openai/GithubService.ts`
- OpenAI Service `src/service/openai/OpenAIService.ts`

## Observações

- Certifique-se de que o provedor e modelo que você está utilizando suporta o uso de ferramentas e está configurado corretamente.

> Para mais informações sobre o uso de ferramentas com a OpenAI, consulte a documentação oficial: [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling?api-mode=chat)
