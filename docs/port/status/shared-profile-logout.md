# Shared Profile logout option

Status: additive, unconnected option for role owners. `showDirectLogout` is optional and the existing default remains visible; only a caller explicitly passing `false` hides the direct Profile logout row. Settings and their existing confirmation keep receiving the same `onLogout` callback. No existing role, Worker or Preparation call site was changed, and no new route was added.

Mocked cross-role tests cover the omitted default, explicit true/false, the existing Worker and Preparation defaults, ProfileScreen prop forwarding, and the separate iOS/Android Settings confirmation. These tests do not establish device rendering or lifecycle behavior. Boyoqchi route wiring, its drawer/logout behavior, session/Chat safety and phone verification remain in its role branch and are not enabled by this option.

Verification before integration: 22 focused Profile and Preparation tests passed. The full Node suite reported 1,264 passed and the same six pre-existing Preparation Android Expo UI ESM failures as current main. iOS TypeScript, lint, ledger and both offline Expo JavaScript exports passed; Android TypeScript retained the same nine existing Worker errors. No native build or phone test was run.
