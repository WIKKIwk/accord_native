---
name: accord-port
description: Port Accord V2 (Flutter, ../accord_mobile_v2) into V4 (Expo SDK 58, this repo) role by role with 1:1 behaviour, including the base, build and printer sessions. Use for "port <role>", for V4 API calls, models, business rules, stores, realtime, localization, printing or native bridges that must match V2, and for auditing a role against V2. Not for writing .ios.tsx or .android.tsx views, which belong to accord-port-ios and accord-port-android.
---

# Accord V2 → V4 port

V2 is the specification. V4 must send the same requests, accept the same responses, apply the same
rules and reach the same states. Screens are rebuilt natively and separately for each platform.
Behaviour is never redesigned.

## How the work is cut

Work goes by role, and several sessions run at the same time (see "Parallel sessions"). Logic is ported
**once** and shared. Then Android and iOS each build their own screens, independently. So a role is:

1. One logic session per part (`role <id> <part>`). Most roles have one part once `base` is done.
2. One Android session and one iOS session, which can run at the same time.
3. One audit at the end of the role.

The part you were given is the requested result, so finishing it is the smallest correct change. Stop
when its gates pass.

## Hard limits

1. **V2 is read-only.** Write nothing under `../accord_mobile_v2`. Never run `flutter`, `dart`, `make`
   or `pub` there, because they write `.dart_tool` and `build`. Git there is read-only and always
   `git --no-optional-locks -C ../accord_mobile_v2 ...`. To execute V2 code, use `scripts/v2_oracle.sh`
   or `scripts/v2_contracts.sh`, which work in a temporary export.
2. **Port from the baseline.** The spec is the commit in `docs/port/V2_BASELINE`. Other sessions edit V2
   while you work, so read any file with uncommitted changes through `git show <baseline>:<path>`.
3. **Test server only.** Use `https://mini-rs-erp-test.wspace.sbs` and accounts the user supplies. No
   requests that change data anywhere else. No credentials in files, tests or logs.
4. **The backend does not change.** `../mini_rs_erp` is read-only reference for contracts.
5. **Write only inside this folder.** Other sessions work in the sibling `../accord_mobile_v4*` folders, and
   `../accord_mobile_v4` is the main checkout. Read them if you must, never write there.

## Parallel sessions

Each session has its own folder and branch, made by `scripts/port_worktree.sh <name>`. These rules keep every
branch mergeable.

- **Never work on `main`.** If `git branch --show-current` says `main`, stop before doing anything and tell the
  user to run `.agents/skills/accord-port/scripts/port_worktree.sh <name>` and open that folder. Only the
  integrator writes to `main`. Do not merge, pull or rebase `main` yourself.
- **Your status file** is `docs/port/status/<name>.md`, where `<name>` is your branch without `port/`. Open items,
  deviations, test-mode notes and your stopping point all go there, in this shape. `PORT.md` holds the decisions
  and is read-only for you.
  ```md
  # <name>

  Status: <part n of m in progress, or done>
  Stopped at: <what comes next>

  ## Open items
  | Where | V2 reference | What is needed |
  |---|---|---|

  ## Deviations candidates

  ## Test mode pending

  ## Needs from the integrator
  ```
- **Stay in your files:**

  | Session | May write |
  |---|---|
  | `base` | `src/auth.ts`, `src/authorizedFetch.ts`, `src/app/index.tsx`, `src/shared/**` and their tests |
  | `<id>` | `src/<domain>/**`, existing files of this role, `tests/<domain>*.test.cjs`, `tests/contracts/*.json`, `docs/port/roles/<id>.md` |
  | `<id>-android`, `<id>-ios` | What the screen skill's scope fence says |
  | `<id>-audit` | Only its status file. No code |
  | `build` | `app.json`, `eas.json`, `package.json`, `package-lock.json`, `docs/port/BUILD.md` |
  | `printer` | `modules/accord-printer/**`, `src/printing/**`, `tests/printing*.test.cjs`, the `android.permissions` and `ios.infoPlist` keys of `app.json` |

  Existing flat files belong to their domain: `src/worker*`, `OrderScreen` and `WorkerScreen` to `aparatchi`,
  `src/chat*` to `chat`, `src/preparation*` to `preparation`. Everything else is shared and belongs to the
  integrator: `PORT.md`, `DONE_ROLES.txt`, `EXCLUDED.txt`, `V2_BASELINE`, `.agents/`, `AGENTS.md`, `tsconfig*`,
  `src/app/_layout.tsx`, and any file of another role.
- **Need a change in a file that is not yours?** Add a row under "Needs from the integrator" and carry on with
  the rest. Do not edit it.
- **`[x]` means already ported.** Import it. If it is wrong for your role, add a row; do not port it a second
  time.
- **New package:** install it with `npx expo install` and commit only `package.json` and `package-lock.json`,
  alone, as `deps: <package>`. The integrator regenerates the lock file when merging.
- **Simulators and emulators are shared.** Start Metro on your own port: `npx expo start --port <free port>`. If
  the device is in use, finish the code and report that it was not run.

## Base session

`base` runs before the other roles start, because they all build on it. Port the `base` role's open items, then
everything `port_ledger.mjs shared` lists, into `src/shared/`. Those are the methods two or more roles need, and
this keeps parallel sessions from writing them twice. Own role routing as well: port `AppSession.homeRoute` and
`AppRouter.canOpenRoute`, and make `src/app/index.tsx` redirect by role and platform (D7) through one table that
a later role extends with one line. A role with no V4 screens yet shows one plain message telling the user to
keep using V2. Do all parts of `base` in this session. Done means every method `shared` lists is ported or has an open item, and the gates pass. `logout` is ported except its push-token reader, which waits for a Firebase config only the user can add: keep it as an open item and do not block on it.

## Build session

Goal: V4 installs on a real phone, next to V2. Read the SDK 58 docs before each step.

- Add `expo-dev-client` with `npx expo install`. Keep Expo Go working.
- Add `eas.json` with `development`, `preview` (Android APK and iOS internal distribution) and `production`
  profiles. `app.json` already has V4's own bundle id (D10).
- Check with `npx expo-doctor` and `npx expo prebuild --clean --no-install`. `ios/` and `android/` are generated
  and git-ignored: never commit them. If the toolchain exists, also build with `npx expo run:android`.
- Do not run `eas login`, `eas init` or `eas build`, because they need the user's account. Write the exact
  remaining steps for the user to `docs/port/BUILD.md`, in Uzbek.

## Printer session

Goal: V2's `accord/bluetooth_printer`, `accord/bluetooth_printer/discovery` and `accord/usb_printer` channels work in
V4 through a local module. Follow `references/native-bridges.md`.

- Create `modules/accord-printer/`. Port the Kotlin and Swift code, keeping method names, arguments and results.
- Port V2's Dart wrappers and label layouts into `src/printing/`. `port_ledger.mjs worklist printer` finds them.
- Compare TSPL output byte for byte with V2. Use `v2_oracle.sh` to dump V2's bytes for the same input.
- Vendored SDKs need a licence check. If the licence is unclear, add an open item and keep going.
- Without a real printer it is not verified. Say so in your report.

## Start of every session

```sh
git branch --show-current
node .agents/skills/accord-port/scripts/port_ledger.mjs drift
node .agents/skills/accord-port/scripts/port_ledger.mjs role <id> <part>
```

Read `docs/port/PORT.md`, your status file if it exists, and the generated `.port/role-<id>-<part>.md`. If drift
touches code that is already ported, re-port that first and note it in your status file. Moving the baseline is
the integrator's job.

**The reading list keeps you focused.** It comes from what the role's screens really reference, with line
numbers, and excludes code finished roles already cover. Skip `[x]` entries. Read the rest by line range. Do not
scan folders or open whole files unless the code you are reading sends you there.

## How V2 is built

Read `references/v2-anatomy.md` once. The facts that break naive ports:

- **File names mean nothing.** 449 of 1,165 files are generated by `large_library_splitter`.
  `MobileApi` is one class spread over more than 80 `extension X on MobileApi` parts. Search by symbol,
  and never copy these names into V4.
- **Business rules live in widgets.** V2 has 1,931 `setState` calls and only 26 `ChangeNotifier`s. State
  classes and their `*_methods_NN.dart` parts hold guards, validation, retries and ordering. Read them
  as logic. A port that only covers `core/api` is not 1:1.
- **Roles share screens.** The worker queue is `AdminProductionMapOrdersScreen(workerMode: true)`.
  Port only the branches this role can reach. `.port/role-<id>-borrowed.md` lists references into other
  features. Follow one only after checking that this role reaches it at run time.
- **There is no Bloc, Riverpod, GetX, Dio, freezed or go_router.** V2 uses `package:http`, singletons,
  `setState`, `ValueNotifier` and `Navigator.pushNamed`.

## Logic session

1. **If V4 already has it, tag and compare; do not rewrite.** Worker, chat and auth code predate this
   skill and have no tags.
2. **Record the wire contracts** in a role's first logic session. This is cheaper and stricter than
   retyping fixtures:
   ```sh
   .agents/skills/accord-port/scripts/v2_contracts.sh --role <id>
   ```
   It writes `tests/contracts/*.json`, holding what V2's tests really sent and received. It needs approval
   to run outside the sandbox, because Flutter writes to its own cache under `.tools/`. Fixtures already
   recorded at this baseline are kept, so usually only a few files run. Commit the results.
   Requests are recorded even when a V2 test fails. A V2 test that fails at the baseline is not a spec, so
   confirm it with `v2_oracle.sh` and add an open item. `raw_material_split_test.dart` has 3 such tests.
3. **Write V4 tests that replay them.** The test fails if V4 sends anything V2 did not. Add the V2 test's
   assertions on the parsed result, reading that test case only for those:
   ```js
   // @v2-test test/worker_list_api_test.dart
   const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
   const NAME = 'worker single detail requests one ID and returns full action authority';

   test(NAME, async () => {
     const replay = contractFetch('worker_list_api_test', NAME);
     const session = recordedSession('worker_list_api_test', NAME);
     const api = loadTs('workerApi.ts', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) =>
       replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
     const result = await api.readWorkerOrderDetail(session, session.url.searchParams.get('apparatus'),
       session.url.searchParams.get('order_id'), null, new AbortController().signal);
     replay.assertDone();
   });
   ```
   Take `loadTs` from `tests/chatApi.test.cjs`. Tests use `node:test`; there is no Jest here. Pass
   `generated: [...]` for values V2 generates per call, such as idempotency keys and timestamps.
4. **Test policy.** `.port/role-<id>-tests.md` sorts V2's tests into three groups. Contract tests become
   replays. Logic tests have their rules ported. Widget-only tests are **not** ported; put what they assert
   into the UI contract. A contract or logic test you skip needs a reason in your status file. Some roles have few
   V2 tests. For an API method with no recording, write a V4 test that asserts the request and parsing you read
   in the V2 code, and say in your report that V2 itself had no test for it.
5. **Implement until they pass.** Tag each ported symbol once, where it is defined:
   ```ts
   /** @v2 adminItemUoms */
   ```
   Keep the raw JSON field names in types. Reuse `authorizedFetch` and the patterns in `src/`. Add no second
   HTTP client or state library. Before writing a transport or live feature, read
   `references/mechanisms.md`. For anything numeric, date-based, ordered or parsed, read
   `references/dart-to-ts.md`.
6. **Keep logic out of views so each platform can own its screens.** Pure rules go in `*Logic.ts` or
   `*Model.ts`, requests in `*Api.ts`, sockets in `*Live.ts`, React state in `use*.ts`. New roles use
   `src/<domain>/`. When a rule this role needs lives in a shared view such as `OrderScreen.tsx` or
   `WorkerScreen.tsx`, move it into a hook in your own files. If the view belongs to another role, list the
   switch under "Needs from the integrator".
7. **Logic that truly differs by platform** goes in `*.ios.ts` and `*.android.ts`, as `usePinSetup.ios.ts`
   does. Printing and APK install are examples. API and business rules are not.
8. **Native or plugin code:** follow `references/native-bridges.md`.
9. **In the role's last logic session, write the UI contract** at `docs/port/roles/<id>.md`, the main input
   for the iOS and Android sessions. For each V2 screen, sheet and dialog list: V2 symbol and path, entry
   points, the hook that serves it, every state (loading, empty, error, offline, permission denied, disabled,
   frozen and any domain state), each action with its enable condition and result, every text with its l10n
   key, navigation edges, back behaviour, haptics and refresh behaviour. Describe behaviour, not layout.
10. **Run the gates, update your status file, report, stop.** When the last part of a role passes its gates, set
    `Status: done`. The integrator adds the role to `docs/port/DONE_ROLES.txt` when merging. Only roles listed there
    count as already covered in later reading lists. If the prompt names no part and the role has several, do part 1 only and
    say how many parts remain. Work is committed as you go (see "Commits"), not only at the end.

## Parity rules

- Keep every endpoint, verb, header, query parameter, body shape, status-code branch, timeout, retry and
  idempotency key exactly as V2 has them.
- Keep every branch, default, null fallback, sort order, rounding rule, date format and validation.
- Keep V2 bugs and quirks. List them under **Deviations candidates** in your status file with the V2 reference.
  Fix one only when the user asks, after the 1:1 port, in its own commit (D12).
- Generate the localization catalog with a script instead of reading V2's 24,000 lines of tables. Until it
  exists, keep V2's Uzbek string and record the key in the UI contract.
- Add no feature, cache, retry or cleanup that V2 does not have.

## When something has no 1:1 answer

Do not guess, and do not stop the whole part to ask. Add a row to **Open items** in your status file with the V2
reference and what is needed, leave that item unchecked, and finish the rest. Leave no silent gaps and no
`TODO` without a matching row.

## Commits

Commit at every checkpoint, not once at the end. Small commits make each step reviewable and let the user roll
back one area without losing the rest.

- **A checkpoint** is one coherent group whose tests pass: one API area (an endpoint family with its tests and
  `@v2` tags), one rule moved from a view into a hook, the recorded contracts, the UI contract, or a drift
  re-port. In practice that is every 8 to 15 API methods, or whenever you are about to start a different area.
  Do not let a finished group sit uncommitted while you start the next.
- **Before each commit** run the tests you touched and `npx tsc --noEmit -p tsconfig.ios.json`. The full gates
  below run once at the end of a part, and the part's last commit is made after they pass.
- **Stage by explicit path**: `git status --short` first, then `git add <paths>`. Never `git add -A` or `git add .`.
  A file you did not touch that is dirty belongs to the user or another session: leave it out.
- Put the status file rows and `@v2` tags for the group into the same commit.
- **Message:** `port(<role>/<part>): <area>, <n> methods`, for example
  `port(aparatchi/1): queue actions, 9 methods`. The last commit of a part says `done`. One short body line
  naming the V2 files is enough.
- **Commit before you stop.** If the session ends early (limit, context, an open question), commit what passes
  and write the stopping point into your status file first, so the next session resumes from the ledger.
- **Never** push, merge, pull, amend, rebase, reset, stash or force anything. Never commit `.port/` (ignored), credentials,
  `.env` files or anything under `../accord_mobile_v2`.
- `.git` is write-protected in the sandbox, so every commit asks for approval. Make each one count and do not
  split a group into tiny commits only to have more of them.

## Gates

All must pass before you report a part as done:

```sh
node --test tests/*.test.cjs
npx tsc --noEmit -p tsconfig.ios.json
npx tsc --noEmit -p tsconfig.android.json
npx expo lint
node .agents/skills/accord-port/scripts/port_ledger.mjs check
node .agents/skills/accord-port/scripts/port_ledger.mjs role <id> <part>
```

Known baseline, listed in `PORT.md`: `tsconfig.android.json` reports 10 errors in `WorkerOutputProgress.android.tsx`,
`WorkerPaintPalette.android.tsx` and `WorkerScreen.tsx`, and `expo lint` reports 3 `import/no-unresolved` errors.
Do not add more. Every line of the part must be checked, excluded in `docs/port/EXCLUDED.txt`, or listed in
**Open items** of your status file. Resolve every `check` warning that belongs to this role: a V4 endpoint V2 never mentions is
either dynamic in V2 or invented.

## Audit mode

When asked to audit a role, change no code. Run the role's contract replays, then compare V4 with V2 for each
`@v2` tag, branch by branch. Use `scripts/v2_oracle.sh` when expected values are in doubt; it needs the same
approval as `v2_contracts.sh`. Report each mismatch with both file references, its effect, and whether a test
should have caught it. Write the report to `docs/port/status/<id>-audit.md` as well.

## After the roles

- **Test mode** goes last and in one place. See "Test mode rule" in `references/mechanisms.md`.
- **Sweep:** run `port_ledger.mjs status`. Everything still uncovered is ported, excluded with a decision, or
  opened as an item.

## Report format

State the role and part, tokens read, the API methods and tests done before and after, the gate results, new
open items, the commits made (hash and subject), anything left uncommitted and why, and whether it ran on any
simulator or device. Do not say "done" while an unchecked line remains.
