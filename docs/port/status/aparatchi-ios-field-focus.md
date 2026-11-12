# Aparatchi iOS field focus

Completed on `main`, as requested by the user.

## Changes

- The shared iOS report/correction dialog, compact order sheet and order content pass taps directly to native fields with `keyboardShouldPersistTaps="always"`.
- With `handled`, React Native's scroll responder intercepted SwiftUI field touches and blurred the previous input before the next field received focus. SwiftUI handles these touches outside the JS responder system.
- Bobina → metraj → kg can now transfer focus on the first tap. Interactive drag-to-dismiss remains enabled in the shared form.
- Android's existing tap handling is retained. Field values, parsing and submission logic are unchanged.

## Verification

- Regression tests reproduce the previous interception using the installed React Native ScrollView responder methods, then pass with the updated dialog/order props.
- 79 focused form, progress, sheet, native-input and daily-work tests passed, including raw input and Android checks.
- iOS and Android TypeScript projects passed.
- Lint: 0 errors; the existing `AdminClosedHistoryOwner.tsx` dependency warning remains.
- iOS Hermes export passed: `.expo/worker-field-focus-ios`.
- Physical-device focus and keyboard animation were not tested. The regression checks exercise the JS responder contract with mocked native targets.
