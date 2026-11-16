import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { AdminItemDetailCustomerContentProps } from './AdminItemDetailCustomerContentTypes';
import { AdminItemDetailDecisionContentLifetime } from './AdminItemDetailDecisionContentOwner';
import { adminItemDetailDecisionSurface, adminItemDetailDecisionViewport } from './AdminItemDetailDecisionPresentation';
import { dartPartialLower, dartTrim } from './dartJsonString';

export function useAdminItemDetailCustomerContent(props: AdminItemDetailCustomerContentProps) {
  if (typeof props.a !== 'function' || typeof props.t !== 'function') throw TypeError('Original Source text resolvers are required');
  const { surfaceIdentity, controller, a } = props;
  // The original native surface cannot acquire a replacement controller/account/close callback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lifetime = useMemo(() => new AdminItemDetailDecisionContentLifetime(props), [surfaceIdentity]);
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const dialog = lifetime.dialog(), owner = dialog?.kind === 'customers' ? dialog.owner : null;
  const state = useSyncExternalStore(owner?.subscribe ?? emptySubscribe, owner?.getSnapshot ?? emptySnapshot, owner?.getSnapshot ?? emptySnapshot);
  const viewport = adminItemDetailDecisionViewport(props.viewport);
  useLayoutEffect(() => lifetime.attach(props, viewport), [lifetime]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => lifetime.commit(props, viewport));
  const visible = lifetime.matches(props) && lifetime.readCurrent() && !!owner && !!state;
  const rows = state?.customers.map(customer => {
    const key = dartPartialLower(dartTrim(customer.ref));
    return { customer, ticket: owner?.row(customer) ?? null, selected: state.selectedRefs.includes(key), pending: state.pendingRef === key,
      title: dartTrim(customer.name) ? customer.name : customer.ref, subtitle: [customer.ref, customer.phone].filter(value => dartTrim(value)).join(' • '),
      key: `admin-item-customer-option-${customer.ref}` };
  }) ?? [];
  const changeSearch = (query: string) => { if (typeof query === 'string' && lifetime.canInteract()) owner?.changeSearch(query); };
  const searchSubmit = (query: string) => { if (!lifetime.canInteract() || !owner || typeof query !== 'string') return; owner.changeSearch(query); void owner.load(); };
  const searchButton = (query: string) => { if (owner?.getSnapshot().loading === false) searchSubmit(query); };
  const retry = () => { if (lifetime.canInteract() && owner?.getSnapshot().error !== null) void owner?.load(); };
  const toggle = (row: typeof rows[number], assigned: boolean) => {
    if (!lifetime.canInteract() || !owner || !row.ticket || typeof assigned !== 'boolean') return; void owner.toggle(row.ticket, assigned);
  };
  return { lifetime, owner, state, visible, viewport, closing: dialog?.closing ?? true, surface: adminItemDetailDecisionSurface('customers'), title: a('detail.manage_customers'),
    rows, doneEnabled: state !== null && state.pendingRef === null && !state.closing && !dialog?.closing,
    searchEnabled: state !== null && !state.loading && !state.closing && !dialog?.closing,
    close: lifetime.close, changeSearch, searchSubmit, searchButton, retry, toggle,
  };
}
const emptySubscribe = () => () => {}, emptySnapshot = () => null;
export type AdminItemDetailCustomerContentModel = ReturnType<typeof useAdminItemDetailCustomerContent>;
