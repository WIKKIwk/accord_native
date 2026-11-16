import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react';
import { findNodeHandle, StyleSheet, View } from 'react-native';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { AdminFixedSnackBarMotion } from './AdminFixedSnackBarMotion';
import { useAdminFixedSnackBarContext } from './AdminFixedSnackBarProvider';
import type { AdminFixedSnackBarHostProps } from './AdminFixedSnackBarTypes';
import { AdminFixedSnackBarMembershipOwner } from './adminFixedSnackBarMembership';
import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';

function OriginalHost({ scaffold, sourceLayout, isCurrent }: AdminFixedSnackBarHostProps) {
  const { queue, reader, visibility } = useAdminFixedSnackBarContext(), marker = useRef<ComponentRef<typeof View> | null>(null);
  const identity = useMemo(() => ({ queue, scaffold: scaffold.ticket, isCurrent, visibility }), [queue, scaffold.ticket, isCurrent, visibility]);
  const [tag, setTag] = useState<number | null>(null), membership = useMemo(() => new AdminFixedSnackBarMembershipOwner(identity), [identity]);
  const member = useSyncExternalStore(membership.subscribe, membership.getSnapshot, membership.getSnapshot);
  const nativeMarker = useMemo(() => ({ identity, nativeID: createAdminPresentationWindowTicket() }), [identity]), nativeID = nativeMarker.nativeID;
  const ticket = useMemo(() => queue.createHost({ identity, scaffold: scaffold.ticket!, isCurrent: () => membership.getSnapshot() !== null && isSynchronouslyTrue(isCurrent),
    canInteract: () => isSynchronouslyTrue(() => visibility.canInteract(scaffold.ticket!)) }), [queue, identity, scaffold.ticket, isCurrent, visibility, membership]);
  useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  useLayoutEffect(() => {
    const leave = membership.attach(), detach = ticket ? queue.attachHost(ticket) : null;
    return () => { detach?.(); leave(); };
  }, [queue, ticket, membership]);
  useEffect(() => {
    if (!ticket || !membership.current(member)) return;
    queue.setGeometry(ticket, null);
    if (tag === null || sourceLayout.hostHeight === null || !isSynchronouslyTrue(reader.isAvailable)) return;
    let active = true;
    const current = () => active && membership.current(member) && queue.current() && isSynchronouslyTrue(isCurrent) && membership.current(member) && queue.current();
    let stop: (() => void) | undefined;
    try {
      if (!current()) return;
      const returned = reader.observe({ identity, nativeID, nativeTag: tag, scaffold: scaffold.ticket!, sourceLayout, isCurrent: current }, pair => {
        if (!current()) return;
        // This Root snapshot must describe the actual dock host paired by the reader, not an unrelated window's dock.
        queue.setGeometry(ticket, pair && pair.dock.height === sourceLayout.hostHeight ? pair : null);
      });
      if (typeof returned !== 'function') throw TypeError('Original-window reader must release its actual subscription');
      stop = returned;
    } catch { if (current()) queue.setGeometry(ticket, null); }
    return () => { active = false; try { stop?.(); } catch {} queue.setGeometry(ticket, null); };
  }, [queue, reader, identity, nativeID, ticket, member, membership, tag, scaffold.ticket, sourceLayout, isCurrent]);
  const entry = ticket ? queue.entryFor(ticket) : null, geometry = ticket ? queue.geometryFor(ticket) : null;
  const motionIdentity = useMemo(() => ({ entry, ticket, key: entry ? createAdminPresentationWindowTicket() : '' }), [entry, ticket]);
  return <View ref={marker} collapsable={false} nativeID={nativeID} pointerEvents="box-none" style={StyleSheet.absoluteFill} testID="admin-fixed-snackbar-window-marker"
    onLayout={() => { if (!membership.current(member) || !queue.current() || !isSynchronouslyTrue(isCurrent)) return;
      const actual = findNodeHandle(marker.current); if (typeof actual === 'number' && Number.isInteger(actual) && actual > 0 && membership.current(member)) setTag(actual); }}>
    {ticket && member && entry && geometry ? <AdminFixedSnackBarMotion key={motionIdentity.key} host={ticket} scaffold={scaffold.ticket!} entry={entry} geometry={geometry}
      isCurrent={() => membership.current(member) && queue.current() && isSynchronouslyTrue(isCurrent) && membership.current(member)} /> : null}
  </View>;
}
/** Actual window marker can mount before a queued entry exists; unknown geometry never produces a painted bar. */
export function AdminFixedSnackBarHost(props: AdminFixedSnackBarHostProps) {
  const { queue } = useAdminFixedSnackBarContext();
  if (!props.scaffold.ticket || props.scaffold.messenger !== queue.messenger || !queue.current()) return null;
  return <OriginalHost {...props} />;
}
