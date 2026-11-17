# Flutter → Expo migration tracker

Expo SDK: 58 · State: scoped observable controllers and existing hooks · HTTP: authorizedFetch · UI: @expo/ui

This tracker covers the remaining Brigader routes requested on 2026-11-17. Prior role mappings and checkpoints are
in docs/port/status/brigader.md and docs/port/roles/brigader.md. V2 remains read-only.

## Modules

| Module | Status | Logic | API + fixtures | Tests | iOS UI | Android UI | Notes |
|---|---|---|---|---|---|---|---|
| Brigader products/apparatus/notifications/operations/WIP | composed | ported/reused | source requests; no invented fixtures | user owns device tests | native | native | See checkpoints; full-role audit pending |
| Remaining five Brigader routes | in progress | in progress | in progress | user requested own tests | in progress | in progress | Continue until all complete |

## File mapping

| Flutter file | Expo file(s) | Status |
|---|---|---|
| lib/src/features/admin/presentation/admin_wip_batches_screen*.dart | src/brigader/brigaderWipModel.ts, BrigaderWipBatches.* | composed |
| lib/src/features/admin/presentation/admin_production_map_orders_opening_wip.dart | src/brigader/brigaderOpeningWipModel.ts, BrigaderOpeningWip*, src/admin/openingWipDeleteApi.ts | composed |

| lib/src/features/admin/presentation/admin_worker_settings_screen*.dart | src/brigader/brigaderWorkerSettingsModel.ts, BrigaderWorkerSettings*, BrigaderWorkerSurfaces.tsx, src/admin/workerSettingsApi.ts | composed |
| lib/src/features/admin/presentation/admin_calculate_materials_screen*.dart | src/brigader/brigaderCalculateMaterialsModel.ts, BrigaderCalculateMaterials*, BrigaderSequenceList.tsx, src/admin/calculateMaterialCommands.ts | composed |

| lib/src/features/admin/presentation/admin_raw_material_{rules,assignment}_screen*.dart | src/brigader/BrigaderRaw*, brigaderRawRulesModel.ts, src/admin/rawMaterialRulesApi.ts, existing Material assignment model | composed |
| lib/src/features/admin/presentation/raw_material_scan_dialog*.dart | src/brigader/BrigaderRawScanDialog.tsx, BrigaderCameraViewport.tsx, brigaderCameraSession.ts | composed; plugin focus/zoom audit pending |

## Open parity items

Remaining source route inventory and platform surface audit are tracked in docs/port/status/brigader.md.
No synthetic API response fixtures were invented. Physical printing and device acceptance belong to the user.

## Decisions

- 2026-11-17 — User explicitly owns testing. TypeScript, lint and static source comparison are run here; no device, emulator or unit test run.
- Keep actual Brigader identity/capabilities; reuse native views without role impersonation.

| lib/src/features/admin/presentation/admin_progress_qr_* | src/brigader/BrigaderProgressQr*, brigaderProgressQrModel.ts, src/admin/adminProgressQrPassport.ts, adminProgressQrPdf.ts | composed |

| lib/src/features/admin/presentation/admin_progress_qr* | src/brigader/BrigaderProgressQr*, src/admin/adminProgressQrPassport.ts, adminProgressQrPdf.ts | composed |
| lib/src/features/admin/logic/factory_map* and presentation/admin_factory_map* | src/admin/factoryMap{Live,Stock,Status,Bindings,Mapping}, BrigaderFactoryMap*, BrigaderFactoryOrderDetail | composed |
