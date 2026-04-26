# Refined Plan Mode

Refined Plan Mode is a local web app for reviewing AI coding-agent plans with a pull-request-style feedback loop.

Instead of reviewing a long plan in a terminal and replying with one unanchored message, you can open the plan in a browser, leave comments on specific lines, ranges, or selected text, and submit the feedback as structured JSON for the agent to consume.

## Current Status

This is an MVP built for local use. The core review loop works:

- read a versioned Markdown plan from `.plan-review/plans/`
- view the plan as Markdown source in CodeMirror
- add line, range, and text-selection comments
- persist draft comments across reloads
- submit feedback as JSON
- approve a plan and copy it to `.plan-review/approved-plan.md`

## Workflow

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
