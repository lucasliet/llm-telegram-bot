---
name: agents-sync
description: Ensures AGENTS.md is the single source of truth for repository guidelines. Use this skill to synchronize all agent instructions, coding standards, and architectural mandates into a single file.
---
# Agents Sync Skill

This skill mandates that `AGENTS.md` is the primary and authoritative source for all repository-specific instructions, overriding any other agent-specific documentation (like CLAUDE.md or GEMINI.md).

## Core Mandates

1. **Single Source of Truth**: Always prioritize instructions found in `AGENTS.md`.
2. **Proactive Updates**: Whenever a new provider is added, a coding convention is changed, or a project structure is modified, the `AGENTS.md` file MUST be updated immediately.
3. **Consolidation**: Do not create or maintain separate files like `CLAUDE.md`, `GEMINI.md`, or `CODEX.md` for general instructions. If they exist, migrate their content to `AGENTS.md` and remove them or point them to `AGENTS.md`.
4. **Context Loading**: At the start of any task, verify if `AGENTS.md` needs an update based on recent changes in the codebase.

## Workflow

### 1. Verification
Before starting a task, check if the current repository guidelines in `AGENTS.md` are consistent with the project's state.

### 2. Implementation & Sync
After implementing changes (e.g., adding a new service or handler):
- Identify any new patterns or rules established.
- Use the `replace` tool to surgically update the relevant section in `AGENTS.md`.
- Ensure the language remains professional and technical.

### 3. Finalization
A task is only considered complete when `AGENTS.md` reflects the final state of the implementation and its corresponding guidelines.

## Standards
- **Formatting**: Keep the Markdown structure clean with clear headers.
- **Precision**: Updates must be surgical to avoid erasing existing critical mandates.
- **Language**: Portuguese for descriptions/labels where applicable (as per global project style), but maintain technical terms in English.
