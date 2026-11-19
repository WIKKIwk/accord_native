import { useCallback } from 'react';
import { AdminProfileAction } from './AdminProfileAction';
import { AdminWarehouseReservedOrderDetails } from './AdminWarehouseItemRollsOrderDetails.ios';
import { AdminWarehouseItemRollsSheet } from './AdminWarehouseItemRollsSheet.ios';
import { AdminWarehouseMainScreen } from './AdminWarehouseMainScreen.ios';
import type { AdminWarehouseMainScreenProps } from './AdminWarehouseMainScreenTypes';
import { AdminWarehouseRawQrNativeSheet } from './AdminWarehouseRawQrSheet.ios';
import type { AdminWarehouseScreenProps } from './AdminWarehouseScreenTypes';
import { useAdminWarehouseDetailSurface, useAdminWarehouseDetailSurfaceOwner } from './useAdminWarehouseDetailSurface';
import { useAdminWarehouseItemRollsProvider } from './useAdminWarehouseItemRollsProvider';
import { useAdminWarehouseRawQrProvider, type AdminWarehouseRawQrProviderModel } from './useAdminWarehouseRawQrProvider';

function DetailSurface({ model, surface }: { model: AdminWarehouseRawQrProviderModel; surface: ReturnType<typeof useAdminWarehouseDetailSurfaceOwner> }) {
  useAdminWarehouseDetailSurface(surface);
  return <AdminWarehouseRawQrNativeSheet model={model} />;
}

/** The QR presenter is a direct child of Main's existing SwiftUI details Group. */
export function AdminWarehouseScreen(props: AdminWarehouseScreenProps) {
  const { session, witness, isCurrent, onProfile } = props;
  const rolls = useAdminWarehouseItemRollsProvider(session, witness, isCurrent), qr = useAdminWarehouseRawQrProvider(session, witness, isCurrent);
  const surface = useAdminWarehouseDetailSurfaceOwner(qr);
  const profile = useCallback<AdminWarehouseMainScreenProps['renderProfileAction']>(context => <AdminProfileAction session={session} witness={witness} {...context} onProfile={onProfile} />, [session, witness, onProfile]);
  const order = useCallback<AdminWarehouseMainScreenProps['renderReservedOrderDetails']>((orderId, context) => <AdminWarehouseReservedOrderDetails key={orderId} session={session} witness={witness} isCurrent={context.isCurrent} orderId={orderId} />, [session, witness]);
  const detailSurface = useCallback(() => <DetailSurface model={qr} surface={surface} />, [qr, surface]);
  const owned = { renderProfileAction: profile, onItemRolls: rolls.open, renderReservedOrderDetails: order, renderDetailActionSurface: detailSurface };
  const mainProps: AdminWarehouseMainScreenProps = props.scope === 'werka' ? { ...props, ...owned } : { ...props, ...owned, onRawStockQr: surface.open };
  return <><AdminWarehouseMainScreen {...mainProps} />
    <AdminWarehouseItemRollsSheet model={rolls} /></>;
}
