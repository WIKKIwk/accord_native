# Aparatchi Android daily-work navigation

Completed on `main`, as requested by the user.

## V2 references

- `lib/src/core/navigation/app_root_navigation.dart`: push a new destination and pop to an existing home route.
- `lib/src/features/aparatchi/presentation/widgets/aparatchi_dock.dart`: daily-work entry and Home selection.
- `lib/src/features/aparatchi/presentation/aparatchi_daily_work_screen_models_part_02.dart`: daily-work drawer, dock and history lifetime.

## V4 mapping

- `src/WorkerScreen.tsx`: Android daily-work entry pushes a page while retaining the current queue subtree. The profile entry uses the same page. Destination changes wait until the page is removed and require the same active account scope; a token refresh can retain that scope.
- `src/nativeSheet.tsx`: the existing owned native-route presenter also supports full pages, retaining its security-context bridge, duplicate-open guard and owner cleanup.
- `src/app/page/[id].tsx`: full-page rendering and native Back cleanup; unknown or non-page entries return to app entry.
- `src/components/WorkerDailyPage.tsx`: the existing daily-work view, worker drawer and bottom navigation inside the pushed page.

The Home return leaves the original queue, selected apparatus, search, list and thumbnail component state in place. API requests and queue live transport retain their existing owners.

## Verification

- 95/95 tests passed across `nativeSheet`, `workerQueueController`, `workerQueueRecoveryWarm`, `workerWorkInstructions` and `dailyWorkSurfaces`.
- Added repeated daily/Home returns, deferred destination navigation, profile/Back behavior, expired-session rejection, same-account token refresh and full-page route/security coverage.
- Both platform TypeScript projects passed.
- Project lint passed with its existing `AdminClosedHistoryOwner.tsx` dependency warning (0 errors).
- Android Hermes export passed: `.expo/worker-daily-navigation-android`.
- Physical-device scroll and presentation verification was not performed.
