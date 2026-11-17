import { useCallback, useLayoutEffect, useMemo } from 'react';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import type { AdminPrimaryActionProps } from './AdminCreateHubTypes';
import { useAdminCreateHubSourcePrimaryRegistration } from './useAdminCreateHubSourcePrimary';
import { useAdminSourceSceneScaffold } from './AdminSourceSceneScaffoldContext';
import { isAdminSourceSceneScaffoldOwner } from './AdminSourceSceneScaffoldOwner';

/** Mounted by the genuine ready page Primary child. A registration is not a geometry/native presentation receipt. */
export function useAdminSourceScenePrimary(props: AdminPrimaryActionProps) {
  const source = useAdminSourceSceneScaffold(); if (!isAdminSourceSceneScaffoldOwner(source)) throw TypeError('The original Source scene primary owner is required');
  const generation = source.getSnapshot().generation, { isCurrent, canInteract } = props;
  const rawRead = useMemo(() => createProfileSessionGuard(isCurrent), [isCurrent]), rawCommand = useMemo(() => createProfileSessionGuard(canInteract), [canInteract]);
  const read = useCallback(() => source.readCurrent(generation) && rawRead() && source.readCurrent(generation), [source, generation, rawRead]);
  const command = useCallback(() => source.canOpenPrimary(generation) && rawCommand() && source.canOpenPrimary(generation), [source, generation, rawCommand]);
  const registration = useAdminCreateHubSourcePrimaryRegistration({ ...props, identity: source.primaryIdentity(), isCurrent: read, canInteract: command });
  useLayoutEffect(() => {
    if (!registration.matches) return; const stop = source.connectPrimary(registration.owner, generation);
    // A rejected second/foreign producer must not start an orphan global registration in the passive phase.
    if (!stop) { registration.owner.invalidate(); return; } return stop;
  }, [source, generation, registration.owner, registration.matches]);
}
