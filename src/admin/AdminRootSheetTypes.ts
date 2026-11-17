import type { AdminOwnedSheetCapability } from '../../modules/accord-admin-presentation/src/AccordAdminOwnedSheet';
import type { AdminOwnedSheetRetirementCapability } from '../../modules/accord-admin-presentation/src/AccordAdminOwnedSheetRetirement';
import type { AdminRootPresentationContent, AdminRootPresentationParent } from './adminRootPresentationChain';
import type { AdminRootSheetCancellationLease } from './adminRootSheetLifecycle';

/** Only the owned native foundation's fixed geometry is supported. No intrinsic sizing or resize receipt is inferred. */
export type AdminRootSheetOptions = Readonly<{ heightPoints: number; cornerRadius: number }> &
  (Readonly<{ platform: 'android'; barrierOpacity: number }> | Readonly<{ platform: 'ios' }>);
export type AdminRootSheetRequest = Readonly<{
  kind: 'sheet'; parent: AdminRootPresentationParent; identity: object; presentation: AdminRootSheetOptions;
  nativeCapability: AdminOwnedSheetCapability; retirementCapability: AdminOwnedSheetRetirementCapability;
  renderContent: AdminRootPresentationContent;
  isCurrent: () => boolean; subscribeCurrent: (changed: () => void) => (() => void);
  onRequestClose: (lease?: AdminRootSheetCancellationLease) => void;
}>;
/** Each request needs the same original show/cleanup binding and a subscribed Source owner, then real native receipts. */
export const adminRootSheetAdmission = Object.freeze({ status: 'conditional' as const, reason: 'original-owner-and-native-receipts-required' as const });
export function captureAdminRootSheetOptions(value: AdminRootSheetOptions): AdminRootSheetOptions | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const { platform, heightPoints, cornerRadius } = value, barrierOpacity = platform === 'android' ? value.barrierOpacity : undefined;
    if (!['android', 'ios'].includes(platform) || !Number.isFinite(heightPoints) || heightPoints <= 0 ||
      !Number.isFinite(cornerRadius) || cornerRadius < 0 || platform === 'android' && (typeof barrierOpacity !== 'number' || !Number.isFinite(barrierOpacity) || barrierOpacity < 0 || barrierOpacity > 1)) return null;
    return Object.freeze(platform === 'android' ? { platform, heightPoints, cornerRadius, barrierOpacity: barrierOpacity! }
      : { platform, heightPoints, cornerRadius });
  } catch { return null; }
}
