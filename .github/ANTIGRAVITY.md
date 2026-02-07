# Provider Antigravity - Arquitetura e Thought Signatures

O provider Antigravity integra o bot com a API Cloud Code (Google Cloud AI Companion), permitindo acesso gratuito a modelos como Gemini 3 Flash e Claude Sonnet 4.5 via OAuth2.

## Arquitetura

```
src/service/
├── antigravity/
│   ├── AntigravityOAuth.ts        # Gerenciamento de tokens OAuth2 (refresh/access)
│   ├── AntigravityTypes.ts        # Tipos Gemini (GeminiContent, GeminiContentPart, payload)
│   ├── AntigravityTransformer.ts  # Conversao OpenAI <-> Gemini format
│   ├── AntigravityCache.ts        # Cache em memoria de thought signatures
│   └── AntigravityConfig.ts       # Configuracao runtime
└── openai/
    └── AntigravityService.ts      # Service principal (extends OpenAiService)
```

### Fluxo de Dados

O `AntigravityService` estende `OpenAiService` e converte entre os formatos OpenAI Chat Completions e Gemini nativo:

```
[User Message]
    ↓
[OpenAI Format] → AntigravityTransformer.toGeminiFormat() → [Gemini Format]
    ↓
[Antigravity API] ← makeRequest() com endpoint fallback
    ↓
[SSE Stream Gemini] → transformStream() → processGeminiChunk() → [OpenAI Stream Format]
    ↓
[ChatCompletionsStreamProcessor + AgentLoopExecutor] (reuso do pipeline OpenAI)
```

### Endpoints e Fallback

A API possui tres endpoints com fallback automatico (status 429 ou 5xx):
1. `daily-cloudcode-pa.sandbox.googleapis.com`
2. `autopush-cloudcode-pa.sandbox.googleapis.com`
3. `cloudcode-pa.googleapis.com`

## Thought Signatures e Tool Calls

A API Gemini com "thinking" habilitado exige que chamadas de funcao (`functionCall`) incluam um campo `thoughtSignature` no nivel do **part** (nao dentro de `functionCall`). Sem isso, a API retorna erro 400:

```
Function call is missing a thought_signature in functionCall parts
```

### Como Funciona

Referencia: https://ai.google.dev/gemini-api/docs/thought-signatures

O campo `thoughtSignature` e uma assinatura criptografica gerada pela API que vincula o "pensamento" do modelo a chamada de funcao resultante. Ao reenviar o historico com tool calls, a API valida essas assinaturas.

### Estrutura do Part com Signature

```json
{
  "role": "model",
  "parts": [
    {
      "functionCall": {
        "name": "search_searx",
        "args": { "query": "tempo amanha" }
      },
      "thoughtSignature": "abc123..."
    }
  ]
}
```

O `thoughtSignature` fica **ao lado** de `functionCall` no part, nunca dentro dele.

### Ciclo Completo com Tool Calls

```
1. Usuario envia mensagem → buildPayload() → API Gemini

2. API retorna stream SSE com functionCall + thoughtSignature:
   { functionCall: {name, args}, thoughtSignature: "sig_xyz" }

3. processGeminiChunk():
   - Gera callId unico (call_xxx)
   - Armazena em toolCallSignatures Map: call_xxx → sig_xyz
   - Emite chunk OpenAI com tool_call id=call_xxx

4. AgentLoop executa a tool e obtem resultado

5. Na proxima chamada, buildPayload():
   - toGeminiFormat(messages, toolCallSignatures)
   - Encontra tool_call id=call_xxx no historico
   - Busca signature: toolCallSignatures.get("call_xxx") → "sig_xyz"
   - Gera part: { functionCall: {...}, thoughtSignature: "sig_xyz" }

6. API valida signature e responde normalmente
```

### Fallback: Sentinel Value

Quando a signature original nao esta disponivel (ex: tool calls de sessoes anteriores), usa-se o sentinel `skip_thought_signature_validator`. Esse valor e aceito pela API como bypass de validacao.

```typescript
export const SKIP_THOUGHT_SIGNATURE = 'skip_thought_signature_validator';
```

## Cache de Thinking Signatures

O `AntigravityCache.ts` mantem um cache em memoria de signatures para thinking blocks (diferente de tool call signatures). Caracteristicas:

- **TTL**: 1 hora
- **Limite**: 1000 entradas por sessao
- **Chave**: SHA-256 de `sessionId:thinkingText`
- **Eviction**: Remove metade das entradas mais antigas ao atingir o limite

Usado pelo `filterUnsignedThinkingBlocks()` no `AntigravityService` para preservar ou descartar thinking blocks ao reenviar historico.

## Autenticacao OAuth2

O `AntigravityOAuth.ts` gerencia o ciclo de vida dos tokens:

- **Refresh token**: Configurado via env var `ANTIGRAVITY_REFRESH_TOKEN`
- **Access token**: Renovado automaticamente (valido ~1h, refresh 1min antes de expirar)
- **Project ID**: Descoberto via `v1internal:loadCodeAssist` ou configurado via `ANTIGRAVITY_PROJECT_ID`
- **Singleton**: Uma unica instancia compartilhada

## Variaveis de Ambiente

| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `ANTIGRAVITY_REFRESH_TOKEN` | Sim | Refresh token OAuth2 |
| `ANTIGRAVITY_PROJECT_ID` | Nao | ID do projeto (auto-descoberto se ausente) |
| `ANTIGRAVITY_KEEP_THINKING` | Nao | Preserva thinking blocks na resposta (`true`/`false`) |
| `ANTIGRAVITY_CACHE_TTL` | Nao | TTL do cache de signatures em ms (padrao: 3600000) |

## Comandos Disponiveis

| Comando | Modelo |
| --- | --- |
| `antigravity:` / `antigemini:` | Gemini 3 Flash |
| `anticlaude:` | Claude Sonnet 4.5 |
