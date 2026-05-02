# /rpm:review

Use the Refined Plan Mode skill to audit the latest plan before the user reviews it.

Steps:

1. Read the current plan version.
2. Review the plan for missing context, vague steps, untested assumptions, risky sequencing, and weak validation.
3. If improvements are needed, write a revised next version and update `.plan-review/.current-version`.
4. If the plan is already review-ready, leave files unchanged.
5. Reply with either the new plan version written or a short explanation that the current plan is ready for review.

This command reviews plan quality. It does not implement the plan.
