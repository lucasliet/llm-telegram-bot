# GitHub Workflows for LLM Telegram Bot

This directory contains GitHub Actions workflows that automate testing and code
quality checks for the project.

## Available Workflows

### tests.yml

This workflow runs on every push to the `main` branch and on pull requests
targeting `main`. It performs the following tasks:

1. **Setup Environment**: Configures the GitHub Actions runner with Deno
2. **Code Quality Checks**:
   - Verifies code formatting with `deno fmt --check`
   - Runs the linter with `deno lint`
3. **Test Suite**:
   - Executes all tests using `./run_tests.sh`
   - The script ensures tests are run in a controlled environment with proper
     mocks
4. **Coverage Reporting**:
   - Generates a code coverage report
   - Uploads the coverage data to Codecov

## Configuration

The workflow uses the following secrets:

- `BOT_TOKEN`: Telegram bot token for running tests

For testing purposes, it also sets:

- `ADMIN_USER_IDS`: Set to "12345|67890" for testing

## Local Testing

You can run the same checks locally before pushing:

```bash
# Format code
deno fmt

# Lint code
deno lint

# Run tests
./run_tests.sh
```

## Troubleshooting

If the workflow fails:

1. Check the logs in the GitHub Actions tab
2. Ensure all tests pass locally
3. Check if there are formatting or linting issues
4. Verify that the required secrets are set in the repository settings
