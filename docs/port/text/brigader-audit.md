# Brigader text audit — 2026-11-17

Scope: the 25 formerly missing Brigader route compositions on both platforms. V2 is read-only at `052655a4`.
Actual surface/flow inventory is in `../status/brigader.md`, with file mapping in `../../../MIGRATION.md`.

The unchanged role text script exits 1. It reaches 48 V2 strings and two Create surfaces, then promotes whole native
folders and scans more than 900 files for each platform (`scopeFiles`, port_ledger.mjs:679; textReport:709).
Results: iOS 33 missing / 325 additional, Android 33 missing / 330 additional; 0 ambiguous tags and 611/617 global-only rows.
Zero text exception rows were added; these diagnostics are not a green gate or proof of a complete text comparison.

| Diagnostic | Actual source/read path | Verdict |
|---|---|---|
| Faoliyat | V2 widgets/admin_dock.dart:37; V4 Brigader dock uses existing localized getter/activity destination | Already rendered through existing localization; literal scanner misses the resolved value |
| Warm/cache/page parser errors | V2 admin_sequence_warm_store/admin_order_page_cache and mobile_api_admin_order_page private validation branches | Internal structural errors are not new labels; keep existing guarded shared readers |
| Test calculation failures and default BOPP metal / PE oq / PE PR | V2 `_testModeCalculate`, `_testModeCheckedTemplateIdentity`, test-mode catalog helpers | Test mode is excluded by existing project D3; genuine Brigader admission rejects test-mode-token |
| Minified factory renderer, HTML/CSS, PDF/XML syntax | V4 factoryMapRendererBundle, HTML document, adminProgressQrPdf and escape helpers | Executable/serialized data is not UI wording; use actual Source renderer/PDF and translated visible status |
| Multiline JSX/code fragments flagged as text | V4 native/common TSX; current handwritten tsStrings lexer | TypeScript AST distinguishes these from rendered text; no fake exception entry |
| Original-account/native lifecycle errors | Guards in scoped controllers/native owners; Source-facing failures map through existing localized error policy | Technical guards are not an extra user step/label |
| Long opened-order error body | V2 adjacent Dart string literals; V4 actual combined paragraph | Copy the complete Source message; do not shorten it to satisfy literal matching |
| Global-only texts from other roles | Whole-folder promotion includes existing Supplier, Worker and Admin code | Preserve unrelated user/shared code; actual Brigader reachability is covered by the route/surface audit |

A separate TypeScript AST inventory over 317 changed/new source files (renderer bundle excluded as executable data)
found 17 direct visible string literal occurrences and 821 static calls to the existing localization/text functions.
All occur in the V2 source corpus. This avoids matching JSX code as a string; it does not claim to prove dynamic text,
API-provided text or behavior. Source-order, title/body/buttons, validation and enabled/default/dismissal rules were
compared in the explicit surface audit. Existing localization tables were reused without rewriting their translations.
