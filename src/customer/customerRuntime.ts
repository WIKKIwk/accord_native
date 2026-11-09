import type { Session } from '../auth';
import { customerStatusDetails, customerSummary } from './customerApi';
import { CustomerStore } from './customerStore';
import { customerDeliveryRuntimeStore } from '../shared/notificationStoresRuntime';


/** Binds the V2 CustomerStore to the active session and shared delivery runtime. */
export function createCustomerStore(session: Session): CustomerStore {
  return new CustomerStore({
    customerSummary: () => customerSummary(session),
    customerStatusDetails: kind => customerStatusDetails(session, kind),
  }, customerDeliveryRuntimeStore);
}
