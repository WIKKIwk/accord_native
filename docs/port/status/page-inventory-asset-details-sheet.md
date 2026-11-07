# page-inventory-asset-details-sheet

Status: partial
Stopped at: Android order picker ported; real-device verification remains.

Scope: the requested order picker inside the raw-material details sheet. Other asset details and iOS are outside this change.

## Surface audit

| V2 surface and location | V4 file | iOS | Android | What differs |
|---|---|---|---|---|
| Order picker: `raw_material_order_assignment_section.dart:181` | `src/preparation/PreparationInventoryOrderPicker.android.tsx` | Out of scope | Partial | Search, selection and 50-item paging are implemented; native sheet and keyboard still need a real-device check. |
| Apparatus picker: `raw_material_order_assignment_section.dart:324` | `src/preparation/PreparationInventoryAssignmentSection.android.tsx` | Out of scope | Existing | V2 uses a sheet; the existing Android dialog is outside the requested order-picker change. |

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| Android order picker | `_openOrderPicker` | Verify nested sheet, keyboard, dismissal and assignment on a real phone. |
| Page text gate | `_InventoryAssetDetailsSheet` | The whole-page comparison reports 1 missing and 40 additional strings; the other asset-detail surfaces were outside the requested scope. No rows were accepted. |
| Project gates | Existing Android worker screens and warehouse/history tests | Android typecheck reports 9 pre-existing worker errors; the full test run has 6 existing failures from the Compose modifiers test mock. |

## Deviations candidates

None for the requested order picker.

## Test mode pending

None.

## Needs from the integrator

None for the requested change.
