# Text ledger scope diagnostics

`port_ledger.mjs text <role-or-page> <ios|android|both>` retains the existing text checks and adds three blocking diagnostics:

- **Ambiguous selected `@v2` tags:** the selector uses a short name also found in more than one V2 declaration. The list gives the V4 tag and candidate V2 locations. An extension location is the containing declaration, not necessarily the member's exact line.
- **V2 text matched only through ambiguous native scope:** the normal missing-text check found a match only in files pulled in by an ambiguous tag. Confirm the actual screen and its V2 origin.
- **V4 text matched globally but not in reached V2 declarations:** the normal added-text check found the text somewhere in V2, but not in the role graph's reached declarations. The string may belong to another role, a borrowed screen or localization. Check its real source and reachability.

These diagnostics are unresolved scope risks, not a verdict that a particular difference is real. A nonzero exit means the text gate remains unresolved, even when the ordinary missing/added counts are zero. Do not record an invented exception just to silence it. Text exceptions retain their existing per-platform behavior and require a factual reason and source. An ambiguous identity itself cannot currently be resolved through a text exception: the integrator must repair provenance and scope selection.

This checkpoint only detects the named patterns. The graph does not index every nested class member and does not fully model dynamic routes, borrowed features, localization keys, or untagged shared components. Folder promotion, global source matching and per-screen context still need a provenance-aware graph and route/localization reachability redesign. A zero exit means no existing check or implemented diagnostic found a problem; it is not proof of complete parity. Perform the required surface audit regardless.

## 2026-11-09 integration verification

Merged current main `7bdec60` into the original branch as `71fb8f8`; only the existing scope-diagnostic script, this document and its focused tests differ from main. JavaScript syntax, all 16 synthetic ledger fixtures, source-tag check (1,030 source and 87 test tags), and zero V2 drift passed. No app runtime code or text exception was changed. The real Boyoqchi gate remains open with two ambiguous tags, 1 iOS-only uncertain match and 482 iOS/489 Android global-only matches; Homashyo has no ambiguous tags but 59 global-only matches per platform. Existing missing/added counts remain unchanged. These diagnostics identify unresolved provenance and never certify whole-surface parity.
