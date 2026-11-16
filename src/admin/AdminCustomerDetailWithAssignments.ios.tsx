import { AdminCustomerApparatusCard } from './AdminCustomerApparatusCard.ios';
import { AdminCustomerDetailRoute } from './AdminCustomerDetailRoute.ios';
import type { AdminCustomerDetailWithAssignmentsProps } from './AdminCustomerDetailWithAssignmentsTypes';
import { AdminCustomerMaterialWarehouseEditor } from './AdminCustomerMaterialWarehouseEditor.ios';
import { AdminProfileAvatar } from './AdminProfileAvatar.ios';

/** Source Customer/Material detail with its genuine avatar, apparatus scope and Material warehouse owners. */
export function AdminCustomerDetailWithAssignments(props: AdminCustomerDetailWithAssignmentsProps) {
  return <AdminCustomerDetailRoute {...props} renderAvatar={avatar => <AdminProfileAvatar session={props.session} witness={props.witness} {...avatar} />}
    renderApparatusCard={apparatus => <AdminCustomerApparatusCard {...apparatus} />} renderMaterialWarehouseEditor={warehouse => <AdminCustomerMaterialWarehouseEditor {...warehouse} />} />;
}
