#!/usr/bin/env bash
# Setup genérico do Deno para qualquer projeto rodando no Claude Code Web.
#
# Uso:
#   ./setup-deno-env.sh
#
# O que faz:
#   - baixa e instala o Deno (release latest, x86_64-unknown-linux-gnu) em
#     /usr/local/bin (sobrescreve override via DENO_INSTALL_DIR);
#   - exporta DENO_CERT apontando para o bundle do sistema, necessário no
#     Claude Code Web porque a saída TLS passa por um proxy de inspeção que
#     apresenta um certificado emitido por uma CA interna — sem isso, fetchs
#     para deno.land, jsr.io, registry.npmjs.org etc. falham com
#     "invalid peer certificate: UnknownIssuer".
#
# Para que DENO_CERT persista em shells futuros desta sessão, faça:
#   source ./setup-deno-env.sh
# (assim o export afeta o shell atual; executando direto, vale só pelo script).

set -euo pipefail

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
		err "CA bundle $CA_BUNDLE não encontrado — fetchs Deno podem falhar com UnknownIssuer"
		return 0
	fi
	export DENO_CERT="$CA_BUNDLE"
	log "DENO_CERT=$DENO_CERT"
	log "para shells futuros: export DENO_CERT=$CA_BUNDLE"
}

install_deno
configure_cert
log "ambiente Deno pronto."
