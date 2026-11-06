---
name: port
description: The one entry point for porting Accord V2 to V4 from start to finish without supervision. Use when the user writes "$port", "port qil" or "port", or names a role or page to port. Asks which role or page and which platform, then runs the logic, screens, wiring, word-for-word text check and self-audit on its own.
---

# Port

V2 is the specification. A worker who moves from V2 to V4 must meet nothing new: the same words, sheets, dialogs,
buttons, order, steps and results. Porting means copying behaviour, so never simplify, improve, shorten or make a
prototype. This is the whole job, and "a page that looks similar" is a failed port.

## 1. Ask once

If the user's message already names a target, skip the question. Otherwise read `docs/port/DONE_ROLES.txt` and the ids
in `.agents/skills/accord-port/references/roles.json`, then send this and wait:

> Qaysi role yoki page'ni port qilay? Platforma: iOS, Android yoki ikkalasi?
>
> Rollar: <ids, with the finished ones marked ✓>

If the answer names no platform, do both. Ask nothing else now.

## 2. Find the target

The project is the folder holding `docs/port/PORT.md`. If the current folder is not it, use `accord_mobile_v4` inside the
current folder or next to it. Run every command below from there, by absolute path.

- **The answer is a role** if it matches an id or title in `roles.json`. Its id is the session name.
- **Otherwise it is a page.** Run `node .agents/skills/accord-port/scripts/port_ledger.mjs page "<answer>"`. It accepts a
  class name, an `AppRoutes` name, or a word shown on the page, and prints the session name. Exit code 2 lists several
  matches: show them and ask which one. This is the only other question you may ask before working.

Make the folder: `.agents/skills/accord-port/scripts/port_worktree.sh <session name>`. Work only in the
`../accord_mobile_v4-<session name>` it prints. If that folder already existed:

- Nothing unmerged (`git log main..HEAD` is empty) and a clean tree: run `git merge --ff-only main`.
- Unmerged commits: this is earlier work, so read its status file, run `git merge --no-edit main`, resolve any conflicts,
  and continue from there.

Then read `docs/port/PORT.md` and follow one of these to the end:

- Role: [references/role.md](references/role.md)
- Page: [references/page.md](references/page.md)

## How this differs from the other port skills

`$accord-port`, `$accord-port-ios` and `$accord-port-android` hold the procedure, so read the sections the steps name.
Their "Hard limits", "Parity rules", "Commits" and no-simulator rules still apply. Where they say otherwise, this wins:

- **One session does everything.** Logic, the screens of each platform asked for, and the wiring all happen here, in one
  chat, with one status file: `docs/port/status/<session name>.md`.
- **Do every part.** Do not stop after part 1, after a gate, or to ask whether to continue.
- **No integrator rows.** You may write this scope's domain files, both platforms' views and routes,
  `docs/port/roles/<session name>.md`, `docs/port/text/<session name>.tsv`, new files in `src/shared/`, and the lines that
  connect this scope in `src/shared/appRoutes.ts`, `src/app/index.tsx` and `src/app/_layout.tsx`.
- **Another role's file:** change it only when this scope cannot work otherwise, with the smallest edit, and name it in
  your report.
- **Never write:** `docs/port/PORT.md`, `DONE_ROLES.txt`, `EXCLUDED.txt`, `V2_BASELINE`, `.agents/`, `AGENTS.md`, `tsconfig*`,
  `main`, or anything in `../accord_mobile_v2`. Never push.
- **New package:** install it with `npx expo install` and commit it alone as `deps: <package>`.

## What a person sees must not change

1. **Words.** Copy V2's text letter for letter: spelling, the `‘` and `’` characters, punctuation and capitals. Add no
   text V2 does not have: no hint, label, subtitle, empty message or error message of your own.
2. **Sheets, dialogs and messages.** Every one in the `text` report exists on each platform. It opens at the same moment
   and has the same title, body and button labels, in the same order, with the same effect. It dismisses the same way:
   swipe, back and tapping outside, and whatever V2 blocks while saving stays blocked.
3. **Kind of surface.** A bottom sheet stays a bottom sheet, a dialog stays a dialog, and a snackbar stays a short message.
   Do not merge two steps into one, and do not split one into two.
4. **Order and flow.** Keep the same fields, rows and actions in the same order, the same number of steps to finish a task,
   the same defaults, validation messages and enable conditions, and every loading, empty and error state.
5. **Native look is the only allowed difference** (D7): the platform draws its own controls. That never justifies dropping,
   renaming, moving or adding anything. If a native control cannot do what V2 does, add an Open item.
6. **GoDEX stays out** (D13). Do not build its printing, and record any GoDEX choice V2 shows as an Open item.

## Text gate

```sh
node .agents/skills/accord-port/scripts/port_ledger.mjs text <role id or page:<query>> <ios|android|both>
```

It compares V2 and V4 both ways, writes `.port/text-<session name>.md`, and lists every sheet, dialog, snackbar and back
guard. It must exit 0. Each row gets one verdict:

- **Fix V4**, which is the normal answer.
- **Accept it** with a row in `docs/port/text/<session name>.tsv`: `platform<TAB>text<TAB>reason`, where platform is `ios`,
  `android` or `both`. The reason cites a fact with a location, such as `V2 never shows this: <file:line>` or `built from
  parts in <V4 file:line>`. Never add a row only to turn the gate green. A V4 text that is merely useful is a fix, not an
  exception: remove it.

## Surface audit

The gates prove little about behaviour, so this comes last and is not optional. Go through every screen in the ledger
report and every item in the text report's sheets and dialogs list. Read the V2 code and the V4 code side by side, then
add a row to a `## Surface audit` table in your status file:

```md
| V2 surface and location | V4 file | iOS | Android | What differs |
```

Write `ok` only after comparing the rules above. Fix what differs and run the gates again. Anything you cannot fix becomes
an Open item, not an `ok`.

## Keep working

- Do not ask whether to continue, or which of two ways is better: V2 decides. Pick what V2 does.
- With no 1:1 answer, or a need only the user can meet (a credential, a Firebase file, a device), add an Open item and do
  the rest. Never fake it, and never stub it.
- If the session must end early, commit what passes and write the stopping point in the status file. `$port` with the same
  target resumes from there.

## Report

Write to the user in Uzbek, briefly:

- **Holat:** `tayyor` only with no Open items left, otherwise `qisman`.
- **Papka va shox**, and that it is not merged into `main`.
- **Qilindi:** screens and sheets ported, per platform.
- **Tekshiruv:** the gates with their real results, and how many text rows were accepted.
- **Qilinmadi:** every Open item, plainly.
- **Telefonda tekshiring:** the few steps that are most likely to be wrong. No simulator or device was used, so say so.
