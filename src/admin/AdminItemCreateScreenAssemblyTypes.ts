import type { ReactElement } from 'react';
import type { AdminCreateHubScaffoldLayout } from './AdminCreateHubProvider';
import type { AdminItemCreateScreenProps } from './AdminItemCreateScreenTypes';
import type { AdminTopNoticeScaffold } from './adminTopNoticeModel';
import type { AdminTopNoticeScaffoldBinding } from './useAdminTopNoticeScaffold';
import type { AdminRootRouterBinding } from './AdminRootRouterTypes';

export type AdminItemCreateFixedSnackBar = Readonly<{ identity: object; message: string }>;
/** Required genuine Source Messenger queue. It owns an accepted message beyond the originating page's focus/lifetime. */
export type AdminItemCreateFixedSnackBarTarget = Readonly<{
  /** Structural/account/native-host availability, independent of which route currently has focus. */
  isAvailable: () => boolean;
  enqueue: (notice: AdminItemCreateFixedSnackBar) => void;
  /** Use the actual shared queue and Source Scaffold contentBottom, not safeArea.bottom plus a guessed offset. */
  render: (host: Readonly<{ scaffold: AdminTopNoticeScaffoldBinding; sourceLayout: AdminCreateHubScaffoldLayout; isCurrent: () => boolean }>) => ReactElement;
}>;
export type AdminItemCreateScreenAssemblyProps = Omit<AdminItemCreateScreenProps, 'footer' | 'renderPrimaryAction'> & Readonly<{
  canInteract: () => boolean;
  /** Source route pages are siblings even when their native carriers physically nest. No default root metadata. */
  sourceScaffoldAncestor: AdminTopNoticeScaffold | null;
  /** Actual localized native/Material semantic dismiss action, resolved by the root host. */
  topNoticeDismissLabel: string;
  fixedSnackBars: AdminItemCreateFixedSnackBarTarget;
}> & (Readonly<{ expectedRootBinding?: undefined; footer: AdminItemCreateScreenProps['footer']; renderPrimaryAction: NonNullable<AdminItemCreateScreenProps['renderPrimaryAction']> }> |
  /** The actual Root SourceDock owns the only dock. A scene never supplies a second footer. */
  Readonly<{ expectedRootBinding: AdminRootRouterBinding; footer?: never; renderPrimaryAction?: never }>);
