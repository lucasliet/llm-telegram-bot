#!/bin/bash

if ! command -v curl &> /dev/null
then
    echo "curl could not be found, please install it";
    exit;
fi

if ! command -v deno &> /dev/null
then
    echo "deno could not be found, installing...";
    curl -fsSL https://deno.land/x/install/install.sh | sh;
    exec $SHELL;
fi

if ! command -v denon &> /dev/null
then
    echo "denon could not be found, installing...";
    deno install -qAf --global --unstable "https://deno.land/x/denon/denon.ts";
    exec $SHELL;
fi

if [ -f .env ]; then
    set -a;
    source .env;
    set +a;
fi

export SERVER_URL=${SERVER_URL:-"https://llm-telegram-bot.deno.dev/webhook"};
export BOT_TOKEN=${BOT_TOKEN:-$TELEGRAM_CHAT_BOT_TOKEN};
export ADMIN_USER_IDS=${ADMIN_USER_IDS:-$TELEGRAM_USER_ID};
export CLOUDFLARE_API_KEY=${CLOUDFLARE_API_KEY:-$CLOUDFLARE_AI_API_KEY};
export CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID:-$CLOUDFLARE_AI_ACCOUNT_ID};

# Load Codex credentials from ~/.codex/auth.json if available
if command -v jq >/dev/null 2>&1 && [ -f "$HOME/.codex/auth.json" ]; then
  CODEX_ACCESS=$(jq -r '.tokens.access_token' "$HOME/.codex/auth.json")
  CODEX_ACCOUNT=$(jq -r '.tokens.account_id' "$HOME/.codex/auth.json")
  if [ -n "$CODEX_ACCESS" ] && [ "$CODEX_ACCESS" != "null" ]; then
    export CODEX_ACCESS_TOKEN="$CODEX_ACCESS"
  fi
  if [ -n "$CODEX_ACCOUNT" ] && [ "$CODEX_ACCOUNT" != "null" ]; then
    export CODEX_ACCOUNT_ID="$CODEX_ACCOUNT"
  fi
fi

# Load Vertex AI credentials from gcloud application_default_credentials.json
GCLOUD_CREDS="$HOME/.config/gcloud/application_default_credentials.json"
if [ -f "$GCLOUD_CREDS" ]; then
  export VERTEX_CREDENTIALS_BASE64=$(cat "$GCLOUD_CREDS" | base64)
fi

denon run --allow-env --allow-net --allow-read --allow-write --allow-import --unstable-kv --unstable-cron main.ts;

curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
-H "Content-Type: application/json" \
-d "{\"url\":\"$SERVER_URL\"}";
