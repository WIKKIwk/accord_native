import { useCallback, useRef, useState } from 'react';
import { adminText } from '../shared/localization';
import { createAdminUserCreateCustomer, createAdminUserCreateSupplier } from './adminUserCreateApi';
import { adminUsersCache } from './adminUsersRuntime';
import { dartTrim } from './dartJsonString';
import type { Session, SessionWitness } from '../auth';
import { isSessionWitnessCurrent } from '../auth';

export type AdminPartyCreateProps = {
  session: Session; witness: SessionWitness; kind: 'supplier' | 'customer'; locale: string;
  isCurrent: () => boolean; canInteract: () => boolean; onCreated: () => void; onBack: () => void; onProfile: () => void; backLabel: string;
};
/** @v2 _AdminPartyCreateScaffoldState._create */
export function useAdminPartyCreate(props: AdminPartyCreateProps) {
  const name = useRef(''), phone = useRef(''), savingRef = useRef(false), [saving, setSaving] = useState(false);
  const current = useCallback(() => props.isCurrent() && isSessionWitnessCurrent(props.witness) && props.witness.session === props.session, [props]);
  const guard = useCallback(() => { if (!current()) throw new Error('Original party creation session expired'); }, [current]);
  const save = useCallback(async () => {
    if (savingRef.current || !props.canInteract() || !current()) return;
    savingRef.current = true; setSaving(true);
    try {
      const create = props.kind === 'supplier' ? createAdminUserCreateSupplier : createAdminUserCreateCustomer;
      await create(props.session, dartTrim(name.current), dartTrim(phone.current), guard);
      if (!current()) return;
      adminUsersCache.invalidate(); props.onCreated();
    } finally { savingRef.current = false; if (current()) setSaving(false); }
  }, [props, current, guard]);
  return { current, saving, save, title: adminText(props.kind === 'supplier' ? 'user.add_supplier' : 'user.add_customer', props.locale),
    nameLabel: adminText('user.name', props.locale), phoneLabel: adminText('user.phone', props.locale), savingLabel: adminText('user.saving', props.locale),
    changeName: (value: string) => { if (props.canInteract() && current()) name.current = value; },
    changePhone: (value: string) => { if (props.canInteract() && current()) phone.current = value; } };
}
