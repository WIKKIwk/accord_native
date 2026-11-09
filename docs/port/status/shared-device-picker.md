# shared-device-picker

Status: existing GScale device sheet and hook extracted for reuse; no new role route is enabled.

## Open items

| Where | V2 reference | What is needed |
|---|---|---|
| New role consumers | `ManualServerSheet`, `ServerPickerPage` | A one-shot picker and its sheet lifecycle are still under review. Do not connect a consumer until dismiss, hardware back, unmount, session change, late discovery and successive sheet behavior are tested on both platforms. |
| Restricted selections | printer selection | The existing GScale hook's Wi-Fi and Bluetooth selection error handling is unchanged. A new role that can reject a selection needs opt-in handling that leaves the sheet open, without changing existing Worker or Preparation behavior. |
| Existing GScale cancellation | USB discovery | As before the extraction, GScale has no selection generation token: a slow USB result after back, cancel or unmount may still select a device or close a later sheet. This checkpoint does not change that legacy behavior. |
| Printer safety | D13; `PrintService`, Android USB bridge | GoDEX printing remains excluded. The extraction does not prove that a printer is supported or bind a USB print to an exact physical device. New role consumers need their own reviewed safeguards. |
| Native verification | Device sheet | Mocked JavaScript tests do not prove native sheet, discovery, permission or printer behavior. A development build and a real phone and printer are still needed. |

## Checkpoint

The existing iOS and Android GScale DeviceSheet and device-picker hook move to `src/shared/printing/`; GScale supplies the same operator, labels, text hook and close callback. The Wi-Fi default, discovery, manual address, Bluetooth and USB selection, persistence, cancellation and error behavior remain as before for the existing operator. No Worker or Preparation source, role routing or Chat code was changed. A narrow optional selection token is available for future consumers, but no transient consumer is introduced here.

The existing Flutter manual server entry uses the same malformed-address, localhost and failed-probe messages. This extraction does not independently establish full Flutter parity, native behavior or device identity.

## Verification

- The focused shared DeviceSheet and hook tests use mocked components and hardware; no backend, phone or printer was used.
- The full Node suite had 1,204 passes and the same six pre-existing Preparation Android ESM-import failures. iOS TypeScript, uncached Expo lint and the ledger check passed; Android retained the same nine pre-existing Worker TypeScript errors.
- Offline iOS and Android JavaScript exports passed with bytecode disabled. They are not native builds or device tests.
