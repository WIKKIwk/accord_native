import { useIsFocused } from 'expo-router';
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { useAdminCreateHubSourceController } from './AdminCreateHubProvider';
import type { AdminPrimaryActionProps } from './AdminCreateHubTypes';
import { AdminSourcePrimaryRegistrationOwner } from './AdminSourcePrimaryRegistrationOwner';

/** Actual route focus affects new commands, not the original dock's registration/read lifetime. New guard/identity requires a new mounted lifetime. */
export function useAdminCreateHubSourcePrimary(props: AdminPrimaryActionProps & { identity: object }) {
  const controller = useAdminCreateHubSourceController(), focused = useIsFocused(), original = { identity: props.identity, controller, isCurrent: props.isCurrent, canInteract: props.canInteract };
  const [owner] = useState(() => new AdminSourcePrimaryRegistrationOwner(original, { showPrimaryFab: props.showPrimaryFab, actions: props.actions, replacement: props.replacement, hasReplacement: props.replacement != null }));
  useLayoutEffect(() => { owner.commit(original); });
  // Revoke mounted membership in layout cleanup even though actual registration starts in the passive phase.
  useLayoutEffect(() => owner.detach, [owner]);
  useLayoutEffect(() => { owner.commitFocus(focused); }, [owner, focused]);
  // Real React runs child layout effects before the parent Hub's layout start. Register only after that genuine parent commit.
  useEffect(() => { owner.start(); return owner.detach; }, [owner]);
  const { showPrimaryFab, actions, replacement } = props;
  useLayoutEffect(() => { owner.update({ showPrimaryFab, actions, replacement, hasReplacement: replacement != null }); }, [owner, showPrimaryFab, actions, replacement]);
  const ticket = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  return owner.matches(original) ? ticket : null;
}
