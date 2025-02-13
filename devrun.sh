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
export PUTER_TOKEN='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0IjoiYXUiLCJ2IjoiMC4wLjAiLCJ1dSI6InBKemtMQ2dEVGhXMUxnWmZqUDl5UWc9PSIsImF1IjoiaWRnL2ZEMDdVTkdhSk5sNXpXUGZhUT09IiwicyI6ImJRYnZoNTZNT28wYzhvSVRPZkZQWGc9PSIsImlhdCI6MTczOTMxMzQwOH0.6bD63k92y9Los_0vdTnEGmd5jCMj5uyoYAW7osK277s'

denon run --allow-env --allow-net --allow-read --allow-write --allow-import --unstable-kv --unstable-cron main.ts;

curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
-H "Content-Type: application/json" \
-d "{\"url\":\"$SERVER_URL\"}";