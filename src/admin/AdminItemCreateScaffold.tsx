import type { ReactNode } from 'react';
import { useAdminCreateHubScaffoldLayout } from './AdminCreateHubProvider';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { adminItemCreateListBottom } from './adminItemCreateNativeLayout';

/** Requires the actual root Hub provider; its same snapshot supplies measured raw IME and real dock/FAB host height. */
export function AdminItemCreateScaffold({ children }: { children: (listBottomPadding: number | null) => ReactNode }) {
  const scaffold = useAdminCreateHubScaffoldLayout();
  return <AdminShellBodyFrame hasFooter contentPadding="none" testID="admin-item-create-body-frame">{children(adminItemCreateListBottom(scaffold))}</AdminShellBodyFrame>;
}
