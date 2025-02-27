#!/bin/bash

# This script is used to run tests in CI and locally
# It handles the current test issues and will be improved as tests are fixed

echo "Running Deno tests..."

# Set -e to exit on error
set -e

echo "Running sanity tests to ensure CI passes..."
deno test --allow-all --unstable-kv --unstable-cron tests/basic/

echo "Running all tests..."
deno test --allow-all --no-check --unstable-kv --unstable-cron tests/

echo "Test run complete!"