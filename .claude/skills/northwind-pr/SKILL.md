---
name: northwind-pr
description: Write a pull request title and description for the current branch in the Northwind team format (What changed, How I verified it, Acceptance criteria, Deliberately not done). Use when the user asks to write, draft, or fix a PR description for a Northwind ticket, or invokes /northwind-pr.
---

# /northwind-pr

Write the pull request title and description for the work on this branch, in the team's required format. The output must be pasteable into GitHub as-is: no placeholders, no TODOs, nothing to tidy up afterwards.

## The rule that matters most: never invent verification

An invented verification step is the worst thing this skill can produce, worse than any formatting or wording problem. Every line under **How I verified it** must trace to something that actually ran, with output you saw. If you cannot point to it, delete the line and say it was not verified.

The usual way this goes wrong is not lying but filling in gaps. The PR template asks "say what you clicked and what appeared", so the temptation is to describe the click-through that *would* work. Do not. In particular:

- **No browser claim without a browser check.** If nobody opened the page in this session, write "Not checked in the browser" and leave the template's browser checkbox unticked.
- **Say who did a manual check and how.** "Run by Claude Code in the browser pane" is not the same as "I clicked through it", and a control set by a script in the page is not the same as a click. Write which one happened.
- **Do not upgrade results.** A command that printed nothing is "exit 0, no output", not "verified". A check run before the last commit belongs to the code as it was then; re-run it or say so.
- **The user's word counts, but is attributed.** If the user tells you they tested something by hand, write it as theirs ("Lewis clicked through the dialog"); do not restate it as something you observed.

## What to do

### 1. Gather the facts first. Write nothing until you have them.

- `git diff main...HEAD --stat`, then the diff itself: what actually changed.
- `git log main..HEAD --oneline`: how it was sequenced.
- The ticket in `docs/tickets/<TICKET-ID>.md`. Take the ID from the branch name (`NWP-101-export-options` → `NWP-101`); if the branch does not carry one, ask. Copy the acceptance criteria verbatim.

If the diff is empty or the ticket file does not exist, stop and say so.

### 2. Collect verification evidence

Verification is only what was actually run, with its real output:

- Commands already run in this session, and what they printed.
- Anything safe to run now to get real output: `npm test` in `build-battle/merchant-console`, `npx tsc --noEmit`, `npm run lint`. Run them rather than describing what they would show.
- Manual checks (clicking through the UI) only if they happened in this session or the user tells you they did them.

If something was not run, it does not go in this section. Say it was not done instead.

### 3. Check each acceptance criterion against the code

For every criterion, find the code that satisfies it, or find that nothing does. Tick `[x]` only when the code meets it and you can point to where. Partial means `[ ]` with a note saying which half is done and which is not.

### 4. Write it

**Title:** `<TICKET-ID>: <what it does>`, a short imperative phrase such as `NWP-101: add export options`.

**Body**, exactly these sections in this order:

```markdown
## What changed

One paragraph in plain language: what can someone do now that they could not before? Not a list of files.

## How I verified it

- `<command>`: <what it output, e.g. the test summary line>
- <what was clicked, and what appeared>

## Acceptance criteria

- [x] <criterion, verbatim from the ticket>
- [ ] <criterion>: partial. <what is done, what is not>

## Deliberately not done

- <out-of-scope item or follow-up, and why it was left>
```

If nothing was deliberately left out, write "Nothing." under the last heading. Do not drop the section.

### 5. Audit the verification section before you print anything

Go line by line through **How I verified it**. For each line, name the command or check in this session that produced it and confirm the output matches what you wrote. Delete any line you cannot trace, and add it to a closing "Not verified:" line instead. Then check the template checkboxes the same way. If no tests or manual checks ran at all, the section says exactly that.

### 6. Hand it over

Print the title and body. If the repository's `.github/pull_request_template.md` asks for more sections, keep those as well and fill them from the same facts. Then offer to open or update the PR with `gh pr create --title "<title>" --body-file <file>` or `gh pr edit`. Ask before running either: publishing is the user's call.

## Rules

- **Never claim a verification step that was not actually run.** See the section at the top; it outranks every other rule here.
- **Quote real output.** Paste the summary line (`Tests  35 passed (35)`), not a paraphrase of it.
- **Plain language over ceremony.** "Ops can choose which columns go in the export" beats "implemented configurable export functionality".
- **No file lists in What changed.** The diff is already one.
- **Name what is out of scope.** Bugs found but not fixed, follow-ups, and rough edges go under Deliberately not done, with the file where it helps.
- **No emoji, no filler, no closing summary.**

## Why this exists

The reviewer reads the description before the diff. A description built from the diff, the log, and the ticket, with verification limited to what really ran, lets them trust it in thirty seconds instead of re-deriving your intent and re-running your checks.
