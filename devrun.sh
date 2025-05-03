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
    deno install -qAf --global --unstable https://deno.land/x/denon/denon.ts;
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

denon run --allow-env --allow-net --allow-read --allow-write --allow-import --unstable-kv --unstable-cron main.ts;

curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
-H "Content-Type: application/json" \
-d "{\"url\":\"$SERVER_URL\"}";