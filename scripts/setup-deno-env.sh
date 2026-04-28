#!/usr/bin/env bash
# Setup completo do ambiente de desenvolvimento Deno para o llm-telegram-bot.
#
# Uso:
#   ./scripts/setup-deno-env.sh           # instala Deno e popula o cache de deps
#   ./scripts/setup-deno-env.sh --test    # também roda a suíte de testes ao final
#
# Foi pensado para o Claude Code Web (CLAUDE_CODE_ENTRYPOINT=remote), onde:
#   - não há Deno pré-instalado;
#   - a saída TLS passa por um proxy de inspeção que apresenta um certificado
#     emitido por uma CA interna (precisamos apontar DENO_CERT para o bundle
#     /etc/ssl/certs/ca-certificates.crt para validar deno.land, jsr.io e
#     registry.npmjs.org);
#   - downloads transitórios (ex.: cdn.skypack.dev) podem retornar 503 em cold
#     start — o script faz cache antecipado com retry.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DENO_INSTALL_DIR="${DENO_INSTALL_DIR:-/usr/local/bin}"
DENO_RELEASE_URL="https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip"
CA_BUNDLE="${CA_BUNDLE:-/etc/ssl/certs/ca-certificates.crt}"

log() { printf '\033[1;34m[setup-deno]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[setup-deno]\033[0m %s\n' "$*" >&2; }

retry() {
	# retry <max_attempts> <command...> — backoff exponencial 2s,4s,8s,16s
	local max="$1"
	shift
	local attempt=1 delay=2
	until "$@"; do
		if [ "$attempt" -ge "$max" ]; then
			err "comando falhou após $max tentativas: $*"
			return 1
		fi
		log "tentativa $attempt falhou, retry em ${delay}s..."
		sleep "$delay"
		attempt=$((attempt + 1))
		delay=$((delay * 2))
	done
}

install_deno() {
	if command -v deno >/dev/null 2>&1; then
		log "Deno já instalado: $(deno --version | head -n1)"
		return 0
	fi
	log "baixando Deno (latest) de $DENO_RELEASE_URL"
	retry 4 curl -fsSL "$DENO_RELEASE_URL" -o /tmp/deno.zip
	log "extraindo para $DENO_INSTALL_DIR"
	unzip -o /tmp/deno.zip -d "$DENO_INSTALL_DIR" >/dev/null
	chmod +x "$DENO_INSTALL_DIR/deno"
	rm -f /tmp/deno.zip
	log "instalado: $(deno --version | head -n1)"
}

configure_cert() {
	if [ ! -f "$CA_BUNDLE" ]; then
		err "CA bundle $CA_BUNDLE não encontrado — TLS interceptado pode falhar"
		return 0
	fi
	export DENO_CERT="$CA_BUNDLE"
	log "DENO_CERT=$DENO_CERT (necessário para o proxy TLS deste ambiente)"
}

warm_cache() {
	log "populando cache de dependências (deno cache main.ts)"
	retry 4 deno cache --allow-import main.ts
	log "populando cache de testes"
	retry 4 deno cache --allow-import tests/basic/sanity.test.ts
}

run_tests() {
	log "executando suíte de testes via ./run_tests.sh"
	# Defaults seguros para ambiente offline; sobrescreva exportando antes de rodar.
	export OPENAI_API_KEY="${OPENAI_API_KEY:-sk-test}"
	export TELEGRAM_CHAT_BOT_TOKEN="${TELEGRAM_CHAT_BOT_TOKEN:-test}"
	export ADMIN_USER_IDS="${ADMIN_USER_IDS:-1}"
	export CLOUDFLARE_AI_API_KEY="${CLOUDFLARE_AI_API_KEY:-x}"
	export CLOUDFLARE_AI_ACCOUNT_ID="${CLOUDFLARE_AI_ACCOUNT_ID:-x}"
	./run_tests.sh
}

main() {
	install_deno
	configure_cert
	warm_cache
	if [ "${1:-}" = "--test" ]; then
		run_tests
	else
		log "ambiente pronto. Rode com '--test' para executar os testes."
		log "para shells futuros, exporte: export DENO_CERT=$CA_BUNDLE"
	fi
}

main "$@"
