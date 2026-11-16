import type { AdminSystemInsets } from '../../modules/accord-admin-layout/src/AccordAdminLayoutModule';

/** @v2 Supplier SafeArea(top:false) inside extended Scaffold body. The footer removes raw bottom padding. */
export function adminSupplierBodySafeAreaBottom({ metrics, hostHeight }: Readonly<{ metrics: AdminSystemInsets | null; hostHeight: number | null }>): number | null {
  const ime = metrics?.viewInsetsBottom;
  if (typeof ime !== 'number' || !Number.isFinite(ime) || ime < 0 || hostHeight === null || !Number.isFinite(hostHeight) || hostHeight < 0) return null;
  return ime <= hostHeight ? hostHeight : 0;
}
