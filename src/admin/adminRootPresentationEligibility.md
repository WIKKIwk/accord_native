# Root presentation foundation: eligibility and limits

This is an unconnected native carrier framework. It does not admit an Admin route, implement a Source page,
replace the app scaffold, supply a Profile/header, or declare a file page ready. There is no default scene,
content provider, unavailable notice, or `available: true` shortcut.

## Required real host contract

- Create `createAdminRootPresentationSession` once for the original session, witness, permission read scope,
  epoch, mounted root lifetime, platform and `rootIdentity`. The pure class accepts a strict synchronous
  authority callback for controlled tests or another genuine boundary; it is not an authentication adapter.
- Intentionally mount `AdminRootPresentationRootCarrier` with that same `rootIdentity`, required native
  presentation props, a real `onRequestClose`, and a stable original `renderContent(outlet, state)` callback.
  Android additionally requires the genuine capability-checked window observer from the installed module.
  The Root primitive creates a real RNModal window. It does not represent the existing Source base Scaffold.
- Root membership, React registration, layout and optional-module capability do not establish readiness.
  Real RNModal `onShow` establishes native presentation; Android also requires an original marker arm ACK.
  The non-collapsed marker is inside that actual window. Original native callbacks/observer/ticket remain
  captured for the window lifetime. A replacement physical native window needs a new chain/window identity.
- Every real content callback must place its supplied outlet **inside its own actual native presentation
  content**, keep that outlet mounted, and preserve stable component ownership. Do not put outlets beside
  sheets or in a global sibling renderer. An omitted outlet leaves its accepted child unpresented; registration
  never manufactures native readiness or completion.
- Open using the exact opaque `chain.top()` at accepted Source await settlement. Capture the originating
  owner's `isCurrent` independently. Do not replace that authority with the top Profile/page authority.
  Rapid accepted opens receive separate ordered entries, including while a prior carrier is presenting.
  Reflected/proxied/foreign/old parent handles and reused original request identities are rejected.
- Use the LIVE `state.canInteract`/`chain.canInteract` for every queued native action. `state.interactive` only
  describes visual enablement for that render; its captured boolean cannot authorize a later event.
  `state.isCurrent` retains the original read authority independently of focus/topness. An underlying or closing carrier
  is inert. Native Close/Back dispatch invokes only the exact top shown/armed original callback. It does not
  implicitly accept a Source decision.
- An accepted `requestClose(entry)` fences interactions and new descendants. Normal `closed` resolves only
  after original Android window-tree detach or original iOS RNModal `onDismiss`. Hide requests and React
  cleanup are not completion. `retired` is cancellation, never a successful Source return value.

## Lifetime rules

Root/account retirement cancels every original result and observer. StrictMode cleanup/reconnect retains
the original native leases; its deferred cleanup can only retire resources, never complete a window.
Originating request-owner retirement cancels that entry's authority without adopting a newer owner or
retiring an unrelated current Profile. Its already-mounted inert native shell exists only to remove the
original window. A never-mounted cancelled suffix has no native-close success to acknowledge.
The genuine originating owner must call `chain.cancel(originalEntry)` on actual owner unmount, without
tying cancellation to page blur. `refreshAuthority` also rechecks original entry authorities; production
session-witness notifications invoke it. A guard closure changing silently is not a lifecycle subscription.

An ancestor closing with existing descendants keeps the original carrier shell/outlet mounted until those
descendants genuinely close. New opens through closing ancestry are rejected. This is a structural retention
rule, **not proof of physical UIKit child survival**. Source parent-close/new-child timing is unsupported and
must remain held until an actual native transaction is implemented and checked. Caller content must not
remove the outlet when its originating model retires. Native arm failure, missing native callbacks, or
unexpected root loss remains fail-closed; no retry timer or synthetic success is provided.

## Blocking integration / physical Open items

- Only page/dialog RNModal carriers exist. No SwiftUI-sheet parent presentation receipt is implemented.
  SDK58 `BottomSheet.onIsPresentedChange` and SwiftUI `onAppear` are not presentation-complete proof.
- No original Expo file-page navigation/back context forwarding, native iOS carrier header, Profile/UserCreate
  body adapter, source global popup provider, Source rapid-role coalescer correction, or route/native dual
  close fence is connected. Do not mount a native Expo Stack inside an Android RNModal: the installed
  ScreenContainer requires a native screen/fragment provider or ReactRootView ancestry.
- Actual nested native presentation, keyboard/status/safe-area/dock geometry, focus/accessibility, transition
  ordering/duration, Activity recreation, and parent-shell retention require native validation. Java/JS host
  fixtures do not prove these. No device, simulator or native app build was used.
- Android proof is original **window-tree detach**, not compositor animation completion. The existing native
  Kotlin binding/classpath compilation remains independently Open.

Source anchors: f119 `admin_user_create_screen_widgets_part_01.dart:77–113` awaits roles then presents while
mounted; `admin_user_create_screen_helpers_part_04.dart:4–29` presents issued code through the navigator;
`admin_item_create_screen__AdminItemCreateScreenState_methods_01.dart:287–347` retains the customer picker
while pushing CustomerCreate above it; M3 async-picker methods part01:399–416 awaits that result before
selecting. These ordering sections are unchanged at052. SDK evidence: RNModal Fabric presentation completion,
`UIView+React.m:282–292` actual UIKit responder lookup, Android ComponentDialog show listener, and SDK58
BottomSheet nested-content contract. This framework does not itself close the listed Source gaps.
