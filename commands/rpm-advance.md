# /rpm:advance

Use the Refined Plan Mode skill to continue the loop from the current state.

Steps:

1. Inspect `.plan-review/.current-version`, `.plan-review/approved-plan.md`, available plan files, and available feedback files.
2. If an approved plan exists, execute that plan.
3. If feedback exists for the current plan version, incorporate it into the next plan version.
4. If there is a current plan but no feedback or approval, remind the user that the plan is awaiting review.
5. If no plan exists, start with `/rpm:start` behavior.

Keep the response focused on the next state transition.
