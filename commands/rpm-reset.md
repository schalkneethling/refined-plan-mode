# /rpm/reset

Use the Refined Plan Mode skill to find the current `.plan-review` directory and clean it up while keeping the directory itself.

Steps:

1. Look for `.plan-review` in the current workspace root.
2. If `.plan-review` exists, remove all files and directories inside it, including hidden files such as `.current-version`.
3. Keep the `.plan-review` directory itself in place.
4. If `.plan-review` does not exist, report that there is nothing to reset.
5. Reply with a concise summary of what was cleaned up.

Only empty `.plan-review`. Do not remove the `.plan-review` directory itself, source files, or any other workspace files.
