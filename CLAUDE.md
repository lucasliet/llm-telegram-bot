# Instruções para Claude Code

## Detecção de ambiente Claude Code Web

Para verificar se está rodando no Claude Code Web (ambiente remoto em nuvem):

```bash
# A variável CLAUDE_CODE_ENTRYPOINT será "remote" no ambiente web
[ "$CLAUDE_CODE_ENTRYPOINT" = "remote" ] && echo "Claude Code Web"
```

## Configuração do Deno no Claude Code Web

O ambiente Claude Code Web não vem com Deno instalado. Siga os passos abaixo para configurar:

```bash
# 1. Baixar e instalar o Deno do GitHub Releases
curl -fsSL "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip" -o /tmp/deno.zip

# 2. Extrair o binário
unzip -o /tmp/deno.zip -d /usr/local/bin/

# 3. Dar permissão de execução
chmod +x /usr/local/bin/deno

# 4. Verificar instalação
deno --version
```

> **Nota:** O ambiente não tem acesso DNS externo direto, então `deno test` e `deno run` podem falhar ao tentar baixar dependências remotas (deno.land, jsr.io, npmjs.org). O `deno fmt` e `deno lint` funcionam normalmente pois não precisam de rede.

## Formatação

- **Rode `deno fmt` apenas em arquivos TypeScript/JavaScript** (`*.ts`, `*.tsx`, `*.js`, `*.jsx`)
- **NÃO rode `deno fmt` em arquivos Markdown** (`.md`), JSON (`.json`), YAML (`.yml`/`.yaml`) ou outros arquivos de configuração — o formatter do Deno reformata esses arquivos de forma indesejada
- Para formatar apenas os arquivos de código:
  ```bash
  deno fmt --ext=ts,tsx,js,jsx
  ```

## Referência do projeto

Consulte o [AGENTS.md](./AGENTS.md) para diretrizes completas do repositório.
