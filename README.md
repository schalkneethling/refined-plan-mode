# Refined Plan Mode

Refined Plan Mode is a local web app for reviewing AI coding-agent plans with a pull-request-style feedback loop.

Instead of reviewing a long plan in a terminal and replying with one unanchored message, you can open the plan in a browser, leave comments on specific lines, ranges, or selected text, and submit the feedback as structured JSON for the agent to consume.

https://github.com/user-attachments/assets/0a351cd8-94b2-44d7-9f5f-78aeb43a5314

## Current Status

This is an MVP built for local use. The core review loop works:

- read a versioned Markdown plan from `.plan-review/plans/`
- view the plan as Markdown source in CodeMirror
- add line, range, and text-selection comments
- persist draft comments across reloads
- submit feedback as JSON
- approve a plan and copy it to `.plan-review/approved-plan.md`

## Quick Start

Refined Plan Mode has two pieces:

- a browser app in this repository for reviewing plan files
- an agent skill plus slash-command prompts that keep the plan review loop consistent

Use the skill and commands in the coding-agent workspace where the actual work will happen. Then run this browser app against that workspace's `.plan-review` directory.

### 1. Make the skill and commands available to your agent

This repository includes the reusable agent files:

```text
skills/refined-plan-mode/SKILL.md
commands/rpm-start.md
commands/rpm-feedback.md
commands/rpm-advance.md
commands/rpm-checkpoint.md
commands/rpm-review.md
commands/rpm-handoff.md
```

If your agent can load skills and slash commands from a repository, keep these files where they are. If your agent expects global files, copy or symlink them into that agent's skills and commands locations. For Codex, local skills live under:

```text
$CODEX_HOME/skills/refined-plan-mode/SKILL.md
```

After the skill and commands are available, start the review loop from the target project with:

```text
/rpm:start
```

The command asks the agent to use the Refined Plan Mode skill, inspect the project, write the first full plan to `.plan-review/plans/plan-v1.md`, and set `.plan-review/.current-version` to `v1`.

### 2. Run the browser reviewer

From this repository, install dependencies and start the app:

```sh
vp install
PLAN_REVIEW_DIR=/absolute/path/to/target-project/.plan-review vp dev --host 127.0.0.1 --port 5173
```

Open:

```text
http://127.0.0.1:5173/
```

Review the current plan in the browser. You can leave comments on lines, ranges, or selected text, then submit feedback. The app writes feedback for the current version to:

```text
.plan-review/feedback/plan-v1-feedback.json
```

Approving a plan writes:

```text
.plan-review/approved-plan.md
```

### 3. Continue the loop with commands

Use these commands in the target project:

- `/rpm:feedback` reads feedback for the current plan version, writes the next plan version, and advances `.plan-review/.current-version`.
- `/rpm:review` asks the agent to audit the latest plan for quality before you review it.
- `/rpm:advance` moves to the next state: execute an approved plan, incorporate feedback, wait for review, or start a new plan.
- `/rpm:checkpoint` reports the current version, feedback status, approval status, and recommended next action.
- `/rpm:handoff` creates a compact continuation summary for another agent or future session.

The core loop is:

```text
/rpm:start
review in browser
/rpm:feedback
review in browser
/rpm:advance
```

Repeat review and feedback until the plan is approved. Once approved, `/rpm:advance` executes the approved plan.

## Manual Workflow

In the project you want to review, ask the coding agent to write its plan to:

```text
.plan-review/plans/plan-v1.md
```

and create:

```text
.plan-review/.current-version
```

with this content:

```text
v1
```

Then start Refined Plan Mode from this repository:

```sh
PLAN_REVIEW_DIR=/absolute/path/to/project/.plan-review vp dev --host 127.0.0.1 --port 5173
```

Open:

```text
http://127.0.0.1:5173/
```

After submitting a review, feedback is written to:

```text
.plan-review/feedback/plan-v1-feedback.json
```

Ask the coding agent to read that file, address every comment, write the next plan version, and update `.plan-review/.current-version`.

The slash commands above automate these prompts when your agent supports them.

## Suggested Agent Prompts

For the first plan:

```text
When you produce your plan, write the full plan as markdown to the following file:

.plan-review/plans/plan-v1.md

Also create .plan-review/.current-version containing:

v1

Create the directories if they do not exist. Do not summarize or truncate the plan. Then, continue to present the plan to the user.
```

For a review loop:

```text
I reviewed your plan. Read the feedback from:

.plan-review/feedback/plan-v1-feedback.json

Address every comment, then, before presenting the plan again for review, write the revised full plan to:

.plan-review/plans/plan-v2.md

Also update:

.plan-review/.current-version

to:

v2

Do not summarize or truncate the plan.
```

## Development

Install dependencies:

```sh
vp install
```

Run the development server:

```sh
vp dev --host 127.0.0.1 --port 5173
```

Validate changes:

```sh
vp check
vp build
```

`vp test` currently exits with "No test files found" because no tests have been added yet.

## File Convention

```text
.plan-review/
  .current-version
  plans/
    plan-v1.md
    plan-v2.md
  feedback/
    plan-v1-feedback.json
    plan-v2-feedback.json
  approved-plan.md
```

## Notes

The app binds through the Vite+ dev server during local development. A production CLI/server wrapper is not implemented yet.
