# Repository Guidelines

## Project Structure & Module Organization
- `main.ts`: Oak app + grammy bot bootstrap.
- `src/`: production code
  - `handlers/`: command and model handlers (suffix `Handler`)
  - `service/`: integrations and orchestration (suffix `Service`)
  - `repository/`: persistence via Deno KV (suffix `Repository`)
  - `adapter/`, `config/`, `prototype/`, `util/`: support modules
- `tests/`: mirrors `src/` with `*.test.ts`
- `resources/`: prompts and internal docs
- `deno.json`: tasks, formatting, linting, and **centralized imports** (all external dependencies must be declared here)
- `devrun.sh`, `run_tests.sh`: local dev and test helpers

## Build, Test, and Development Commands
- `deno task dev`: runs `devrun.sh` (loads `.env`, starts with `denon`, sets Telegram webhook).
- `deno task test`: runs `run_tests.sh` (full suite + coverage).
- `deno test -A --unstable-kv --unstable-cron tests/service/TelegramService.test.ts`: run a specific test.
- `deno fmt`, `deno lint`: format and lint the codebase.

## Coding Style & Naming Conventions
- Language: TypeScript (`strict` mode). Use TSDoc for all functions; avoid inline `//` comments.
- Formatting: tabs, semicolons, single quotes, line width 160 (see `deno.json`).
- Imports: prefer `@/` alias (maps to `src/`) over relative paths like `../../`. Example: `import { foo } from '@/util/bar.ts'`.
- Naming: files in `src/` use PascalCase and clear suffixes: `*Service.ts`, `*Handler.ts`, `*Repository.ts`.
- Keep functions small, purposeful, and secure; avoid deprecated APIs; handle errors explicitly.

## Testing Guidelines
- Framework: Deno tests in `tests/`, mirroring `src/` structure; filenames end with `.test.ts`.
- Run all: `deno task test`. Coverage is generated automatically.
- Targeted runs: use `deno test` with `-A --unstable-kv --unstable-cron` for KV- and cron-dependent tests.

## Commit & Pull Request Guidelines
- Commits: prefer Conventional Commits (e.g., `feat:`, `fix:`, `docs:`, `test:`, `refactor:`). Write concise, imperative messages.
- PRs: include clear description, rationale, test steps, and any env/config changes. Link related issues.

## Security & Configuration Tips
- Never commit secrets. Store provider keys and tokens in `.env` (e.g., `BOT_TOKEN`, `SERVER_URL`, `ADMIN_USER_IDS`, provider API keys).
- Validate inputs and sanitize outputs when interacting with external providers.

## Code Conventions

### Do not add comments on code
When writing code, do not add // comments. Just write the code.

### Ensure proper formatting
Maintain consistent indentation and spacing throughout the code.

### TSDocs on functions
When writing functions, always include TSDoc comments to describe the function's purpose, parameters, and return value. since its typescript, there is no need
to add types in the function signature. unless the code is javascript.

### Clean code
Write clean, readable code. Avoid unnecessary complexity and ensure that the code is easy to understand. Follow best practices for clean code and the
programming language being used.

### Avoid using deprecated APIs
Avoid using deprecated APIs or methods. If a newer alternative is available, use that instead.

### Security best practices
Always keep security implications of the code in mind. Implement security best practices to protect against vulnerabilities and attacks.

### Ensure proper error handling
Implement proper error handling to manage exceptions and provide meaningful feedback to users.

### Avoid hardcoding sensitive information
Do not hardcode sensitive information such as API keys, passwords, or tokens in the code. Use environment variables or secure storage solutions instead.

### More Rules
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
