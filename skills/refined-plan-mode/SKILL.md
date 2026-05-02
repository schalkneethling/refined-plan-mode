# Refined Plan Mode

Use this skill when the user starts a planning session using plan mode and wants the Refined Plan Mode review loop.

This skill is additive to the agent's current plan-mode guidance. It turns the plan into a versioned Markdown artifact that can be reviewed with line, range, and text-selection comments. The agent remains responsible for reading the feedback, revising the plan, and moving only when the user has approved the plan or explicitly asks to proceed.

## Core Protocol

1. Clarify only what is necessary to produce a useful plan.
2. Write the complete plan to `.plan-review/plans/plan-vN.md`.
3. Write the active version, such as `v1`, to `.plan-review/.current-version`.
4. Present a short summary to the user and point them at Refined Plan Mode for review.
5. After review, read `.plan-review/feedback/plan-vN-feedback.json`.
6. Address every feedback item in the next plan version.
7. Update `.plan-review/.current-version` to the new version.
8. Repeat until the plan is approved.
9. When the plan is approved, read `.plan-review/approved-plan.md` and execute it carefully.

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

Create missing directories when needed. Never summarize or truncate the plan file itself. The file should be self-contained enough for another agent to understand the goal, context, constraints, implementation steps, validation steps, and open questions.

## Plan Shape

Prefer this structure unless the task clearly calls for something else:

```markdown
# Plan vN: Short Title

## Goal

## Current Understanding

## Assumptions

## Open Questions

## Proposed Changes

## Validation

## Risks

## Rollback or Recovery
```

Keep the plan practical. Include file paths, commands, and decision points when known. Call out assumptions explicitly instead of hiding uncertainty inside confident prose.

## Feedback Handling

When feedback exists:

- Read the relevant JSON feedback file before revising.
- Treat every unresolved comment as actionable until clearly addressed.
- Preserve useful parts of the previous plan.
- Add a short `Feedback Addressed` section to the revised plan that maps comments to the changes made.
- If feedback conflicts or cannot be satisfied safely, explain that in the revised plan and ask the user for the smallest useful decision.

## Execution Gate

Do not begin implementation from an unapproved plan unless the user explicitly asks you to proceed. Once `.plan-review/approved-plan.md` exists or the user directly approves the plan in conversation, execute the approved plan and keep the normal agent workflow: inspect files, make focused edits, validate, and report the outcome.

## User Updates

In conversation, keep updates brief:

- Say which plan version was written.
- Say where feedback should be submitted.
- Say which feedback file was read when revising.
- Say when the plan is approved and execution is beginning.

The plan file carries the detail; the chat message should help the user orient without duplicating the full artifact.
