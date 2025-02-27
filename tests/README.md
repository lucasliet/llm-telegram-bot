# Tests for LLM Telegram Bot

This directory contains tests for the LLM Telegram Bot project, using Deno's
built-in testing tools.

## Test Structure

The test suite is organized as follows:

- `test_helpers.ts`: Contains common utilities for testing, including mock
  context creation and mock KV store
- `main.test.ts`: Tests for the main application setup and bot command
  registration
- `service/`: Tests for service layer components
  - `TelegramService.test.ts`: Tests for Telegram bot service logic
- `repository/`: Tests for data access components
  - `ChatRepository.test.ts`: Tests for chat history and user preference storage
- `handlers/`: Tests for model-specific handlers
  - `OpenAIHandler.test.ts`: Tests for OpenAI API integration

## Running Tests

To run all tests:

```bash
deno task test
```

This will execute all tests in the directory with the necessary permissions.

To run a specific test file:

```bash
deno test -A --unstable-kv --unstable-cron tests/service/TelegramService.test.ts
```

## Mocking Strategy

These tests use mocking to isolate components:

1. **Context mocking**: Creating mock Telegram context objects
2. **KV store mocking**: Using an in-memory implementation for Deno.KV
3. **API mocking**: Replacing external API calls with predictable responses
4. **Environment mocking**: Setting up test environment variables

## Test Helper Utilities

- `createMockContext()`: Creates a mock Telegram context with configurable
  properties
- `MockKvStore`: A simple in-memory KV store for testing
- `mockDenoEnv()`: Helper to mock environment variables for testing

## Adding New Tests

When adding new tests:

1. Follow the existing directory structure
2. Use the test helpers for consistent mocking
3. Create focused test cases that isolate specific behaviors
4. Clean up any global modifications in the test teardown
5. Use Deno's test API with `t.step()` for organizing related test cases
