# auth-safety

Status: security decision pending; existing login and protected-role behavior have not been changed.

## Open items

| Where | Evidence | What is needed |
|---|---|---|
| Login redirects | `src/authenticateAccount.ts:55-60`; installed Expo 58 `src/winter/fetch/fetch.ts` and Android `NativeRequest.kt` | Login POSTs `{phone, code}` with the default redirect mode `follow`. If a trusted login server or proxy returns a cross-origin HTTP 307 or 308, an automatically followed request can carry that POST body to the redirect destination. Android source and the upstream OkHttp 4.9.2 redirect logic support this; the React Native version catalog specifies 4.9.2, but final Gradle resolution is not yet verified. A macOS Foundation localhost test using synthetic credentials observed the same POST/body behavior for 307 and 308, but this is not an iPhone test. No deployed-server redirect, real credential disclosure or real-backend request was observed. |
| Automatic reauthentication | `src/auth.ts:368-425` | A 401 refresh can call the same login function with saved credentials. The conditional redirect risk therefore also applies to automatic refresh, not just manual sign-in. |
| Proposed mitigation | Expo 58 `expo/fetch`; `NativeRequest.kt`, `NativeResponse.kt`, `NativeResponse.swift` | An explicit `expo/fetch` request with `redirect: 'error'` and `credentials: 'omit'` would refuse redirects before sending to a new destination and avoid cookies, including if the global RN fetch override is enabled. Direct HTTPS logins would keep their request body and response checks; servers that depend on redirects or cookies could stop working. This changes shared login behavior and requires an explicit user decision and independent tests before integration. No mitigation has been applied. |
| Authenticated API transport | `src/authorizedFetch.ts`; Expo 58 `runtime.native.ts` | Unlike login, this code asks for `redirect: 'manual'` and `credentials: 'omit'`. Installed Expo 58 defaults to `expo/fetch`, whose native Android and iOS sources implement those options. The older RN/XHR fetch path does not implement manual redirects, and can be selected using `EXPO_PUBLIC_USE_RN_FETCH`; no such setting was found in tracked configuration or the current process, but deployment/build environments and devices are unverified. Do not generalize the login finding to every default Expo request. |
| Chat opt-in | `docs/port/status/chat.md`, `docs/port/status/chat-secure.md` on its branch | The native socket prototype does not by itself secure the preceding ticket request or automatic login refresh. Keep new-role Chat activation held until the complete chain is reviewed and validated. |

## Verification limits

The investigation used installed React Native/Expo source, upstream OkHttp 4.9.2 source and synthetic loopback servers. It did not send real credentials, contact the backend, run a simulator or test a real phone. Android's final dependency graph and merged cleartext policy, and iOS SDK/device behavior, remain unverified. Do not describe this conditional finding as a confirmed breach.
