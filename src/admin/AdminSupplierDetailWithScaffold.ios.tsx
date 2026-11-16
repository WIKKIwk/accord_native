import { AdminSupplierDetailRoute } from './AdminSupplierDetailRoute.ios';
import type { AdminSupplierDetailWithScaffoldProps } from './AdminSupplierDetailWithScaffoldTypes';
import { useAdminSupplierScaffold } from './adminSupplierScaffold';

export function AdminSupplierDetailWithScaffold(props: AdminSupplierDetailWithScaffoldProps) {
  const scaffold = useAdminSupplierScaffold(props.isCurrent, props.canInteract);
  return <AdminSupplierDetailRoute {...props} {...scaffold} />;
}
