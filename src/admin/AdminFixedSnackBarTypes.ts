import type { ReactNode } from 'react';
import type { AdminCreateHubScaffoldLayout } from './AdminCreateHubProvider';
import type { AdminItemCreateFixedSnackBarTarget } from './AdminItemCreateScreenAssemblyTypes';
import type { AdminFixedSnackBarEntry } from './adminFixedSnackBarModel';
import type { AdminFixedSnackBarNativePair } from './adminFixedSnackBarGeometry';
import type { AdminTopNoticeScaffold } from './adminTopNoticeModel';

/** A real original-window observer, not the Activity-only layout module or separately sampled JS measurements. */
export type AdminFixedSnackBarNativeReader = Readonly<{
  isAvailable: () => boolean;
  observe: (request: Readonly<{
    identity: object; nativeID: string; nativeTag: number; scaffold: AdminTopNoticeScaffold;
    sourceLayout: AdminCreateHubScaffoldLayout; isCurrent: () => boolean;
  }>, receive: (pair: AdminFixedSnackBarNativePair | null) => void) => () => void;
}>;
/** Actual logical Source route visibility is distinct from physically nested native Modal ancestry. */
export type AdminFixedSnackBarSourceVisibility = Readonly<{
  subscribe: (listener: () => void) => () => void;
  canInteract: (scaffold: AdminTopNoticeScaffold) => boolean;
  tickerEnabled: (scaffold: AdminTopNoticeScaffold) => boolean;
}>;
export type AdminFixedSnackBarPalette = Readonly<{ inverseSurface: string; onInverseSurface: string }>;
export type AdminFixedSnackBarProviderProps = Readonly<{
  reader: AdminFixedSnackBarNativeReader; visibility: AdminFixedSnackBarSourceVisibility;
  /** Source ColorScheme roles are absent from the existing shared reduced palette. No guessed substitution. */
  palette: AdminFixedSnackBarPalette; dismissLabel: string;
  /** Actual platform accessibility disableAnimations, separate from accessibleNavigation. */
  disableAnimations: boolean; children: ReactNode;
}>;
export type AdminFixedSnackBarHostProps = Parameters<AdminItemCreateFixedSnackBarTarget['render']>[0];
export type AdminFixedSnackBarContentProps = Readonly<{
  entry: AdminFixedSnackBarEntry; palette: AdminFixedSnackBarPalette; safeLeft: number; safeRight: number;
}>;
