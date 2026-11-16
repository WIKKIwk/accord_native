import type { AdminItemDetailDecisionHost, AdminItemDetailDecisionViewport } from './AdminItemDetailDecisionContentTypes';

/** The genuine host must activateCustomers(id) after actual native attachment; content mount never activates a read. */
export type AdminItemDetailCustomerContentProps = AdminItemDetailDecisionHost & Readonly<{
  kind: 'customers'; viewport: AdminItemDetailDecisionViewport | null;
  a: (key: string, values?: Record<string, unknown>) => string; t: (key: string) => string;
}>;
