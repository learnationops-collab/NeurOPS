---
name: manage_rules
description: Create, update, and maintain project rules and documentation.
---

# Manage Rules Skill

This skill empowers you to autonomously manage the project's "brain" by creating and updating rule files in `.agent/rules/`.

## When to Use This Skill

- **New Patterns**: When you identify a recurring coding pattern or architectural decision that should be standardized.
- **Tech Stack Changes**: When you add a new library, framework, or tool that changes the development workflow.
- **Documentation Gaps**: When you find that existing documentation (`.agent/rules/*.md`) contradicts the actual codebase.
- **Explicit Instruction**: When the user asks you to "add a rule" or "update the documentation".

## Instructions

### 1. Analyzing the Need

Before writing a rule, verify:
- **Global vs. Local**: Is this a general rule for the whole project (e.g., naming conventions) or specific to a module?
- **Redundancy**: Does a similar rule already exist? If so, **update** the existing file instead of creating a new one.
- **Conflict**: Does this new rule conflict with the user's global preferences? User global preferences ALWAYS win.

### 2. Creating a New Rule File

If no suitable existing file is found, create a new markdown file in `.agent/rules/`.
- **Naming**: Use `snake_case.md` (e.g., `testing_standards.md`, `deployment_workflow.md`).
- **Frontmatter**: Always include the trigger configuration.
  ```yaml
  ---
  trigger: always_on  # or specify when it should trigger
  ---
  ```

### 3. Updating Existing Rules

- **Be Surgical**: Only change what is necessary.
- **Maintain Structure**: Respect the existing headers and numbering of the file.
- **Preserve Self-Correction**: If the file contains a rule like "Mantén este archivo actualizado", ensure it remains.

### 4. Formatting Standards

- **Language**: Español (unless the file is already in English).
- **Style**: Concise, imperative, and actionable.
  - *Bad*: "You should try to use variable names that are descriptive."
  - *Good*: "Usa nombres de variables descriptivos."
- **Code Blocks**: Use standard markdown backticks.

## Conflict Resolution Strategy

1. **User Global Rules** (`<MEMORY[user_global]>`): Highest priority. Never override these.
2. **Specific Rule Files**: High priority for their specific domain.
3. **General Best Practices**: Lowest priority.

## Example Workflow

1. You notice `frontend/` has migrated from `vite` to `next.js`.
2. You check `.agent/rules/arquitectura.md`.
3. You see it still says "Vite".
4. You invoke this skill logic to update `.agent/rules/arquitectura.md` replacing "Vite" with "Next.js" and updating the start command.
