#!/bin/bash

# This script is used to run tests in CI and locally

echo "Running Deno tests..."

set -e

export SERVER_URL=${SERVER_URL:-"https://llm-telegram-bot.deno.dev/webhook"}
export BOT_TOKEN=${BOT_TOKEN:-$TELEGRAM_CHAT_BOT_TOKEN}
export ADMIN_USER_IDS=${ADMIN_USER_IDS:-$TELEGRAM_USER_ID}
export CLOUDFLARE_API_KEY=${CLOUDFLARE_API_KEY:-$CLOUDFLARE_AI_API_KEY}
export CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID:-$CLOUDFLARE_AI_ACCOUNT_ID}

echo "Running sanity tests..."
deno test --allow-all --unstable-kv --unstable-cron --import-map=tests/import_map.json tests/basic/

echo "Running all tests..."
deno test --coverage=coverage --allow-all --unstable-kv --unstable-cron --no-check --import-map=tests/import_map.json --ignore=tests/service/TelegramService.test.ts,tests/main.test.ts,tests/service/BlackboxaiService.test.ts,tests/repository/ChatRepository.test.ts tests/

deno coverage coverage --exclude=tests

rm -rf coverage

echo "Test run complete!"