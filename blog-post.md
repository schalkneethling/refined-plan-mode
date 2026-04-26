# Refined Plan Mode: Reviewing AI Coding Plans Like Pull Requests

Plan mode is one of my favourite parts of using AI coding agents.

Before the agent starts changing code, it pauses and presents a plan. That moment matters. It gives me a chance to check the approach, correct assumptions, trim scope, and make sure the work is heading in the right direction before the codebase starts moving.

But the review experience itself is still rough.

In most terminal-based coding agent workflows, the plan is streamed as a long Markdown block. If the plan is short, that is fine. If the plan is detailed, things get awkward quickly. You scroll back and forth in the terminal, mentally collect feedback, and then type one big follow-up message:

> "In section two, don't do X. Also the test plan is missing Y. Also the migration step should happen later. Also please don't touch Z."

That works, but it does not feel good.

It has the same problem code review would have if pull requests were just pasted into a terminal and reviewers had to respond with one unanchored paragraph of feedback.

So I started building **Refined Plan Mode**.

Refined Plan Mode is a small local web app for reviewing AI-generated plans in a more precise, PR-review-style workflow.

The idea is simple:

1. The coding agent writes its plan to a local Markdown file.
2. Refined Plan Mode opens that plan in a browser.
3. I leave comments anchored to specific lines, ranges, or selected text.
4. The app writes all comments to a structured JSON feedback file.
5. The agent reads that feedback and produces the next version of the plan.

The result is still lightweight, but the interaction feels much more deliberate.

Instead of holding seven pieces of feedback in my head while reading a long plan, I can leave each comment exactly where it belongs.

## Why This Exists

The thing I want from plan mode is not just "ask before coding."

I want a useful review loop.

A good plan review should let me say:

- This step is unnecessary.
- This section is too broad.
- This assumption is wrong.
- This part should happen later.
- Add tests here.
- Do not touch this file.
- This is approved.

The problem is that terminal feedback is not naturally anchored. If I want to comment on a specific paragraph, I have to quote it or describe where it appears. If I want to comment on multiple sections, I have to manually assemble those comments into one coherent message.

That creates friction at exactly the wrong moment.

Plan mode is supposed to reduce risk. But if reviewing the plan becomes tedious, I am more likely to skim, approve too quickly, or forget feedback I meant to give.

Refined Plan Mode treats the plan as a first-class review artifact.

That small shift makes the process feel closer to reviewing a pull request: read, comment inline, submit the review, iterate.

## How The Workflow Works

The current MVP uses a project-local `.plan-review` directory.

A coding agent writes the first plan here:

```text
.plan-review/plans/plan-v1.md
```

It also writes the active version to:

```text
.plan-review/.current-version
```

with contents like:

```text
v1
```

Then I start Refined Plan Mode and point it at that directory:

```sh
PLAN_REVIEW_DIR=/path/to/project/.plan-review vp dev --host 127.0.0.1 --port 5173
```

The app loads the current plan and displays it as Markdown source using CodeMirror.

From there I can:

- click a line number to comment on one line
- drag across line numbers to comment on a range
- select text and attach a comment to that selection
- review all pending comments in a sidebar
- submit the review
- approve the plan

When I click **Submit Review**, the app writes structured feedback to:

```text
.plan-review/feedback/plan-v1-feedback.json
```

That file contains the plan version, source file path, timestamp, review status, line anchors, original text, and comment bodies.

Then I tell the agent:

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

The agent revises the plan, writes `plan-v2.md`, and presents the plan again using its normal UI.

That last part turned out to be important. I still want the native agent approval flow to exist. Refined Plan Mode improves the feedback loop, but it does not need to replace the agent's own approval mechanism.

When the plan looks good, I click **Approve** in Refined Plan Mode. The app writes the approval status and copies the approved version to:

```text
.plan-review/approved-plan.md
```

Then I can approve execution in the coding agent's own UI.

## The Prompts I Am Using

For the first plan:

```text
When you produce your plan, write the full plan as markdown to the following file:

.plan-review/plans/plan-v1.md

Also create .plan-review/.current-version containing:

v1

Create the directories if they do not exist. Do not summarize or truncate the plan. Then, continue to present the plan to the user.
```

For the next review loop:

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

This is intentionally manual for now. The goal of the MVP is to prove the interaction model before adding deeper automation.

## What Exists In The MVP

The current version is small, but usable.

It includes:

- a local browser-based review UI
- CodeMirror-powered Markdown source viewing
- versioned plan files
- line, range, and text-selection comments
- a comment sidebar
- draft comment persistence across reloads
- JSON feedback output
- submit review flow
- approve flow
- canonical approved plan output

It is not trying to be a full code review tool. It is deliberately scoped to one thing: reviewing a single AI-generated plan.

That constraint is useful. It keeps the tool understandable.

## What Still Needs Work

There are plenty of things I would like to improve.

Multi-line selection works, but it could feel smoother. The app could detect new plan versions automatically. The cleanup flow after approval could be nicer. Slash commands could remove some of the manual prompting. A VS Code wrapper might make sense later.

But the MVP already answers the important question:

Does this make plan review feel better?

For me, yes.

The first real review loop felt noticeably cleaner. I was able to read the plan in a proper browser view, leave comments where they belonged, submit them as a batch, and have the agent produce a revised plan from that structured feedback.

That is the core loop.

Everything else is polish.

## Why I Like This Pattern

What I like about this approach is that it does not require the coding agent to become smarter in some magical way.

It gives the human a better interface.

That matters. A lot of AI coding workflow problems are not model problems. They are interaction problems. The model can produce a decent plan, but the human needs a good way to inspect, shape, and approve it.

Pull requests work because they give us an artifact, anchors, comments, history, and approval.

AI plans deserve something similar.

Refined Plan Mode is my first pass at that idea. A small local tool, built for my own workflow, that treats the plan as something worth reviewing properly before the code changes begin.
