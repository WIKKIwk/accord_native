# Port a page

`<id>` is the session name the `page` command printed, such as `page-preparation-materials`. `<query>` is what you passed to
it. Use the ledger at `node .agents/skills/accord-port/scripts/port_ledger.mjs`.

A page is one V2 screen or sheet, plus the sheets, dialogs and screens it opens directly and the logic they need. A page
often shares logic with other pages. Port what it reaches even when that goes beyond the page's own file, because
otherwise it will not behave the same.

1. **See the scope.** Run `drift`, `page "<query>"` and `text page:<query> <platform>`. Read `.port/role-<id>.md`: its first
   line names the routes this page opens that are out of scope. If it has several parts, do all of them with
   `page "<query>" <part>`.
2. **Logic.** Follow "Logic session" in `$accord-port`, steps 1 to 8, for this list only. To record contracts, pass the test
   files directly: `.agents/skills/accord-port/scripts/v2_contracts.sh $(cat .port/role-<id>.contract-tests.txt)`. Put new code in the domain folder
   of the V2 feature it comes from, such as `src/preparation/`. If V4 already has the screen or logic, compare and complete
   it. Do not write a second copy.
3. **UI contract.** Write `docs/port/roles/<id>.md`, as in step 9 of that section, for this page. If the feature's contract
   already covers it, add only what is missing. Copy text exactly as V2 writes it.
4. **Screens.** For each platform asked for, follow its skill: `$accord-port-ios`, then `$accord-port-android`.
5. **Connect it.** Put the route in the feature's existing tree: `src/app/ios-<feature>/` and `src/app/android-<feature>/`. Make
   the screen that opens this page in V2 open it in V4. Then go through the routes listed in step 1. Connect each one V4 has.
   One V4 does not have yet is an Open item: leave that action out rather than faking the destination. If nothing in V4
   leads to this page yet, say so in your report and give its route path, so the user can still open it.
6. **Gates.** All of "Gates" in `$accord-port`, using `page "<query>"` in place of `role`, plus the text gate. Repeat until they
   pass.
7. **Surface audit**, then the gates again if anything changed.
8. **Report**, and set `Status: done` in the status file only when no Open item remains.
