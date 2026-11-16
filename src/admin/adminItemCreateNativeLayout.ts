import { adminSupplierBodySafeAreaBottom } from './adminSupplierScaffoldLayout';

/** Source list has an extra240 after extended Scaffold's actual bottom-widgets padding. */
export function adminItemCreateListBottom(layout: Parameters<typeof adminSupplierBodySafeAreaBottom>[0]): number | null {
  const inherited = adminSupplierBodySafeAreaBottom(layout); return inherited === null ? null : inherited + 240;
}
