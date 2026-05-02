# /rpm:feedback

Use the Refined Plan Mode skill to incorporate submitted feedback into the next plan version.

Steps:

1. Read `.plan-review/.current-version` to find the current version.
2. Read `.plan-review/feedback/plan-vN-feedback.json` for that version.
3. Read `.plan-review/plans/plan-vN.md`.
4. Address every feedback item in a revised plan.
5. Write the revision to `.plan-review/plans/plan-vN+1.md`.
6. Update `.plan-review/.current-version` to the new version.
7. Reply with a short note naming the feedback file read and the new plan file written.

If the feedback file is missing, report the exact path expected and stop.
