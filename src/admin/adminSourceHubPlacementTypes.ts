import type { AdminScaffoldMarker, AdminScaffoldRect, AdminScaffoldViewport } from '../../modules/accord-admin-layout/src/AccordAdminScaffoldLayout';
import type { AdminTopNoticeScaffold } from './adminTopNoticeModel';
import type { Ref } from 'react';
import type { ViewInstance } from 'react-native';

export type AdminCreateHubRenderSlotProps = Readonly<{
  slot?: 'combined' | 'primary' | 'overlay';
  primaryMarker?: Readonly<{ ref: Ref<ViewInstance>; nativeID?: string; onLayout: () => void }>;
}>;

/** Local native geometry/ancestry only. Never global overlay membership, native top or command authority. */
export type AdminSourceHubPlacementReceipt = Readonly<{
  windowIdentity: object; marker: AdminScaffoldMarker; viewport: AdminScaffoldViewport; frame: AdminScaffoldRect; dockHeight: number;
  nativeFrame: number; nativeRevision: number;
}>;
export type AdminSourceHubPlacementRequest = Readonly<{
  scaffold: AdminTopNoticeScaffold; windowIdentity: object; marker: AdminScaffoldMarker; isCurrent: () => boolean;
}>;
