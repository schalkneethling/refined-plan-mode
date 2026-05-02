# /rpm:start

Use the Refined Plan Mode skill to start a plan review loop for the user's current task.

Steps:

1. Inspect the repository enough to understand the task and relevant constraints.
2. Ask only blocking clarification questions. If reasonable assumptions are available, state them in the plan instead of stopping.
3. Create `.plan-review/plans/plan-v1.md` with the complete plan.
4. Create or update `.plan-review/.current-version` with `v1`.
5. Reply with a concise summary and tell the user the plan is ready for review in Refined Plan Mode.

Do not implement the plan yet unless the user explicitly asks you to proceed without review.
