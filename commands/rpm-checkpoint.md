# /rpm:checkpoint

Use the Refined Plan Mode skill to summarize the current review-loop state.

Report:

- Current plan version from `.plan-review/.current-version`, if present.
- Latest plan file path.
- Whether feedback exists for the current version.
- Whether `.plan-review/approved-plan.md` exists.
- The recommended next action.

Do not modify files unless the user also asks you to advance or revise the plan.
