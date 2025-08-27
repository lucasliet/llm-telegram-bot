# Project Overview

## Project Structure
- `main.ts` - entry point that initializes the bot and HTTP server
- `src/` - source files
  - `adapter/` - adapters for integrating external tools and tool responses
  - `config/` - keyboard layouts and model listings
  - `handlers/` - handlers for each command and model
  - `prototype/` - runtime prototype extensions
  - `repository/` - data persistence using Deno KV
  - `service/` - services that interact with LLM providers and Telegram
  - `util/` - utilities for chat configuration and file handling
- `tests/` - automated tests mirroring the source structure
- `devrun.sh` - helper script to run locally
- `run_tests.sh` - script that executes the full test suite
- `deno.json` - project configuration for Deno

## About the Project
Telegram bot powered by multiple large language model providers. It answers user messages, supports model switching, and runs on Deno Deploy with Deno KV for persistence.

## How It Works
`main.ts` creates an Oak application and a grammy bot. Commands register model actions and utilities. `TelegramService` orchestrates model selection, message handling, and webhook setup. Repositories store conversation history, allowing the bot to operate via webhook or long polling.

# Code Conventions

## Do not add comments on code
When writing code, do not add // comments. Just write the code.

## Ensure proper formatting
Maintain consistent indentation and spacing throughout the code.

## TSDocs on functions
When writing functions, always include TSDoc comments to describe the function's purpose, parameters, and return value. since its typescript, there is no need to add types in the function signature. unless the code is javascript.

## Clean code
Write clean, readable code. Avoid unnecessary complexity and ensure that the code is easy to understand. Follow best practices for clean code and the programming language being used.

## Avoid using deprecated APIs
Avoid using deprecated APIs or methods. If a newer alternative is available, use that instead.

## Security best practices
Always keep security implications of the code in mind. Implement security best practices to protect against vulnerabilities and attacks.

## Ensure proper error handling
Implement proper error handling to manage exceptions and provide meaningful feedback to users.

## Avoid hardcoding sensitive information
Do not hardcode sensitive information such as API keys, passwords, or tokens in the code. Use environment variables or secure storage solutions instead.

## More Rules
- Code should be easy to read and understand.
- Keep the code as simple as possible. Avoid unnecessary complexity.
- Use meaningful names for variables, functions, etc. Names should reveal intent.
- Prefer writing functions that are small and do one thing well. They should not exceed a few lines.
- Function names should describe the action being performed.
- Prefer fewer arguments in functions. Ideally, aim for no more than two or three.
- Strive to make the code self-explanatory.
- When comments are used, they should add useful information that is not readily apparent from the code itself.
- Properly handle errors and exceptions to ensure the software's robustness.
- Use exceptions rather than error codes for handling errors.
- Prefer Composition over Inheritance unless you have a good reason to use inheritance.
