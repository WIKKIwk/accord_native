# Flutter → Expo migration tracker

Expo SDK 58 · Existing scoped controllers/hooks · authorizedFetch · Native Compose / SwiftUI

The 25 remaining Brigader route compositions requested on 2026-11-17 are implemented on both platforms.
Source requests, parameters, revisions, idempotency, branch conditions, validation, errors and return values
were compared with the read-only V2 checkout `052655a4` (Brigader baseline `f11910bb`).
The detailed source/surface audit and previous checkpoints are in `docs/port/status/brigader.md`.
This is not a claim of physical camera/printer acceptance or completion of previously inherited Work Map differences.

## File mapping

All Expo paths below are relative to `src/`; platform leaves use `.android.tsx` / `.ios.tsx`.

| V2 source under lib/src/ | V4 implementation | State |
|---|---|---|
| features/admin/presentation/admin_factory_map_screen*, admin_factory_map_viewer; logic/factory_map* | brigader/BrigaderFactoryMap*, brigaderFactoryMapModel; admin/factoryMap* | composed; live/stock/binding/detail audited |
| features/admin/presentation/admin_calculate_orders_screen*; state/calculate_order_store | brigader/BrigaderCalculateOrders*, brigaderCalculateOrdersModel, BrigaderCalculateStore | composed; canonical archive and edit/delete return |
| features/admin/presentation/admin_calculate_screen* | brigader/BrigaderCalculate*, brigaderCalculateModel, brigaderCalculateDraft, calculateProductPicker | composed; full/compact/editor/manual/automatic flows |
| features/admin/presentation/admin_production_map_test_screen*; models/production_map* | brigader/BrigaderProductionMap*, brigaderProductionMapModel, productionMap*; admin/productionMapDraft* | composed; graph, compatibility, locks, formula, atomic save |
| AppRouter adminItemBulkMove/adminItemCreate branches; features/admin/presentation/admin_item_create_screen* | brigader/BrigaderItemCreate*, existing AdminItemCreateScreen | both source branches composed |
| features/admin/presentation/admin_item_detail_screen* | brigader/BrigaderItemDetail*, BrigaderItemDetailPresentations, existing AdminItemDetail | composed; original DTO and actual child result |
| features/admin/presentation/admin_production_map_orders_opening_wip.dart | brigader/BrigaderOpeningWip*, brigaderOpeningWipModel, openingWipPrintState; admin/openingWipDeleteApi | composed; creation, retry printing, list, deletion |
| features/admin/presentation/admin_wip_batches_screen* | brigader/BrigaderWipBatches*, brigaderWipModel | composed; source loading and filters |
| features/admin/presentation/admin_notifications_screen* | brigader/BrigaderNotifications*, brigaderNotificationsModel | composed; guarded live/reconnect and decisions |
| features/admin/presentation/admin_apparatus_settings_screen*; AppRouter apparatus settings/groups/create | brigader/BrigaderApparatus*, brigaderApparatusController | all three source branches composed |
| features/admin/presentation/admin_raw_material_rules_screen*; AppRouter settings/rules | brigader/BrigaderRawSettings*, BrigaderRawRules*, brigaderRawRulesModel | both source aliases composed; exact tab/default behavior |
| features/admin/presentation/admin_raw_material_assignment_screen*; raw_material_scan_dialog* | brigader/BrigaderRawAssignments*, BrigaderRawScanDialog, BrigaderCameraViewport; existing Material assignment model | composed; real binding, candidates, scan/manual and revision |
| features/admin/presentation/admin_calculate_materials_screen* | brigader/BrigaderCalculateMaterials*, brigaderCalculateMaterialsModel, BrigaderSequenceList; admin/calculateMaterialCommands | composed; density/variants, drag reorder and rollback |
| features/admin/presentation/admin_worker_settings_screen* | brigader/BrigaderWorkerSettings*, BrigaderWorkerSurfaces, brigaderWorkerSettingsModel; admin/workerSettingsApi | composed; workers/groups and captured original identity |
| features/admin/presentation/admin_create_hub_screen*; widgets/admin_create_hub_sheet* | brigader/BrigaderCreateHub*, BrigaderPrimaryAction, genuine shared AdminCreateHubProvider | six page rows / five default menu actions composed |
| features/admin/presentation/admin_progress_qr* | brigader/BrigaderProgressQr*, brigaderProgressQrModel; admin/adminProgressQrPassport, adminProgressQrPdf | composed; all reports, scan-only, manual, PDF |
| AppRouter apparatusQueue branch; admin production queue worker-mode source | brigader/BrigaderApparatusPages*, existing WorkerScreen/controllers | composed; genuine role, queue QR callback, apparatus menu |
| features/aparatchi/presentation/aparatchi_work_instructions_screen* | brigader/BrigaderApparatusPages*, existing WorkerWorkInstructions | composed; apparatus catalog and source drawer |
| features/aparatchi/presentation/aparatchi_daily_work_screen* | brigader/BrigaderApparatusPages*, existing DailyWorkScreen | composed; date/produced WIP and source actions |
| features/aparatchi/presentation/aparatchi_paddons_screen* | brigader/BrigaderPaddons*, brigaderPaddonListModel | composed; genuine non-operator all-apparatus branch |
| features/aparatchi/presentation/aparatchi_paddon_detail_screen* | existing WorkerPaddonDetail, brigader/BrigaderPaddonPrimary, BrigaderApparatusDock | composed; real controller actions, scan/back guards, print/selection |
| core/scanner/reliable_mobile_scanner*; vendored mobile_scanner | brigader/brigaderCameraSession, useBrigaderCamera, shared CameraSurface | real readiness, two starts, 8s/4s timeouts, platform detection policy, raw scan window |
| features/admin/presentation/raw_material_scan_dialog_models_part_02.dart; order detail ListView | OrderScreen.tsx and the Android Expo Camera patch | order and roll merge fill the same clipped square in a rebuilt Android app; Expo Go retains its fitted preview |

## Verification and limits

- The user owns tests: no unit, device, emulator or simulator tests were run for this request.
- Android and iOS TypeScript plus focused lint are the software checks; final results are recorded in the status file.
- Actual route inventory: all 25 requested entries exist in both native trees; original private arguments/results remain scoped.
- No fabricated API fixtures, identities, capabilities, device results or native close acknowledgements were introduced.
- The existing text-gate graph reports 48 V2 strings and only two Create surfaces while scanning more than 900 V4 files per platform.
  Its nonzero result remains recorded, with zero blanket exceptions. See `docs/port/text/brigader-audit.md` for the separate audit.
- Expo Camera does not expose V2's focus-point / MLKit auto-zoom controls. Raw scan containment and detection/retry rules are ported;
  those native camera controls and device-specific torch availability remain limitations, rather than simulated behavior.
- GoDEX stays excluded by the existing project decision. Existing supported USB/Bluetooth/network printer paths are retained.
- A development binary containing the local native modules and newly added react-native-webview is required for device acceptance.

## Decisions

2026-11-17: reuse existing V4 workers, native lists/buttons/filters, original guarded API clients and shared navigation owners.
Retain the actual Brigader profile throughout. The user's changes in the main checkout must survive integration byte for byte.
