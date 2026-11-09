# Qolipchi integration checkpoint: WIP, not buildable

This is an incomplete merge checkpoint, not ready for main or production. It merges the original source branch `port/qolipchi` at `1b0385e5f4cf5359fccf03658fbeb1810ad7f896` onto `45b21d2a07a8e97e37091176c93ae6e40b91793f`. The original source branch and worktree are preserved.

The nine add/add overlaps below use the reviewed main versions to retain its guarded, read-only Home behavior. Other Qolipchi additions remain in this checkpoint. The source branch contains the alternative work for those overlaps; the two implementations still need a careful integration that preserves both the witness protections and the role APIs, state, and session contracts.

- `src/qolip/qolipApiCommon.ts`
- `src/qolip/qolipBlocksApi.ts`
- `src/qolip/qolipHomeBlockReadState.ts`
- `src/qolip/qolipHomeOwnerRuntime.ts`
- `src/qolip/qolipHomeOwnerState.ts`
- `src/qolip/qolipHomePresentation.ts`
- `src/qolip/qolipHomeState.ts`
- `src/qolip/qolipLocationsApi.ts`
- `src/qolip/qolipSettledHomeSession.ts`

Verification of this resolution before this note: 590 of 650 Qolip-focused Node tests passed and 60 failed. The iOS TypeScript check reported 30 errors, including missing block/location APIs and incompatible Home owner/state interfaces. No device or live-service tests were run. Do not treat this checkpoint as a buildable or safe completed port.
