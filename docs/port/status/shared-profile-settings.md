# Shared iOS Profile settings opener

An optional registration callback lets a role-owned header open the existing iOS Profile Settings sheet while that Profile is focused. No existing caller supplies the option; when absent, the registration component and its focus hook are not mounted. Existing Worker and Preparation call sites and default settings behavior remain unchanged. Android and web retain their current Profile UI.

The registration callback is valid only while its Profile registration is focused and is invalidated on blur, unmount, or replacement. Role-owned consumers must additionally guard their own active account and session; this option does not solve unobserved account changes or native event dispatch races. The current port remains unconnected to any new role route.

Mocked unit coverage checks the default, focus, blur, replacement, stale callback, and unmount paths. iOS navigation, native presentation, accessibility, and device lifecycle still require real-device testing.

Integration verification: 19 focused Profile tests passed. The full Node suite reported 1,269 passed and the same six existing Preparation Android Expo UI ESM failures as main. iOS TypeScript, Expo lint, the ledger and offline iOS and Android Expo JavaScript bundles passed. Android TypeScript retained the same nine existing Worker diagnostics. These are not native builds or real-phone tests.
