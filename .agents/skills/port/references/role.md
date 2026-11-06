# Port a role

`<id>` is the role id. Use the ledger at `node .agents/skills/accord-port/scripts/port_ledger.mjs`.

1. **See the scope.** Run `drift`, `role <id>` and `text <id> <platform>`. Read `.port/role-<id>.md` for how many parts there
   are, and the text report once, so you know every word and sheet this role must end with. If drift touches code that is
   already ported, re-port it first and note it in the status file.
2. **Logic.** For each part in order, run `role <id> <part>` and follow "Logic session" in `$accord-port`, steps 1 to 8.
   Existing V4 code is compared and completed, not rewritten. `[x]` entries are imported.
3. **UI contract.** Write `docs/port/roles/<id>.md` as in step 9 of that section, or compare and complete it if it exists.
   Copy text exactly as V2 writes it.
4. **Screens.** For each platform asked for, follow its skill: `$accord-port-ios`, then `$accord-port-android`. Every surface in
   the role report gets a real view with its `@v2` tag.
5. **Connect it.** The role's home target in `src/shared/appRoutes.ts`, its routes, drawer and dock destinations, and every
   button that opens another screen. A destination in another role that V4 does not have yet is an Open item. Leave that
   action out rather than faking it.
6. **Gates.** All of "Gates" in `$accord-port`, plus the text gate. Repeat until they pass.
7. **Surface audit**, then the gates again if anything changed.
8. **Report**, and set `Status: done` in the status file only when no Open item remains.
