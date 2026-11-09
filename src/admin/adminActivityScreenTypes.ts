import type { ReactNode } from 'react';
import type { AdminStoreSnapshot } from './adminStore';

/** Content only. The owner provides a scope-bound snapshot, confirmation, refresh and actual shell. */
export type AdminActivityScreenProps = {
  snapshot: Pick<AdminStoreSnapshot, 'loadingActivity' | 'loadedActivity' | 'activityError' | 'activityItems'>;
  hiddenIds: ReadonlySet<string>;
  navigation: { icon: 'back'; label: string; onPress: () => void; testID?: string } | null;
  footer?: ReactNode;
  onRefresh: () => Promise<void>;
  /** Open the real localized confirmation; the host must recheck scope before hiding current IDs. */
  onRequestClear: () => void;
};
