# Accord List scroll reader

iOS-only local Expo UI view, using the SDK 58 public `UIBaseViewProps`,
`ExpoSwiftUI.View`, `Children()` and `ExpoUIView` extension APIs. It adds a
`ScrollViewReader` around the existing List; it does not replace List, rows,
native swipe actions, refresh or camera rendering.

Paddon scanner activation supplies the existing camera row's stable ID. The
deferred, cancellable native task scrolls once, at alignment `0.08`, for `280ms`
with V2's ease-out-cubic curve. Clearing the target cancels a pending task.
Ordinary scan feedback updates do not repeat the scroll.

Rebuild the development app after native project generation/autolinking; Expo
Go and older app binaries cannot load this module and retain manual scrolling.
No npm dependency is added. The SwiftUI content can be checked directly with
the installed iPhoneOS SDK and `tests/native/AccordListScrollTypecheck.swift`.
The complete Expo wrapper requires the app's ExpoUI/ExpoModulesCore CocoaPods
build; pure SwiftUI typechecking does not validate that integration or physical
camera/scroll/swipe timing.

Sources: [Expo SDK 58 extending guide](https://docs.expo.dev/versions/v58.0.0/sdk/ui/swift-ui/extending/),
[Apple ScrollViewReader](https://developer.apple.com/documentation/swiftui/scrollviewreader).
