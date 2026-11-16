import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminProgressQrTechnicalMaterialProps } from './AdminProgressQrTechnicalMaterialTypes';
import { adminProgressQrTechnicalMaterial } from './adminProgressQrTechnicalMaterialPresentation';

type Host = Pick<AdminProgressQrTechnicalMaterialProps, 'sectionIdentity' | 'isCurrent' | 'canInteract'>;
class TechnicalSectionLifetime {
  private readonly members = new Set<object>(); private readonly listeners = new Set<() => void>();
  private expanded = false; private retired = false; private checking = false; private readonly original: Host;
  constructor(props: Host) { this.original = Object.freeze({ sectionIdentity: props.sectionIdentity, isCurrent: props.isCurrent, canInteract: props.canInteract }); }
  matches = (props: Host) => props.sectionIdentity === this.original.sectionIdentity && props.isCurrent === this.original.isCurrent && props.canInteract === this.original.canInteract;
  commit = (props: Host) => { if (!this.matches(props)) this.retired = true; };
  attach = () => { const member = {}; this.members.add(member); return () => { this.members.delete(member); }; };
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.expanded;
  current = () => {
    if (this.retired) return false;
    if (this.checking) { this.retired = true; return false; } this.checking = true;
    const valid = isSynchronouslyTrue(this.original.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.retired = true; return false; } return true;
  };
  setExpanded = (value: boolean) => {
    if (typeof value !== 'boolean' || !this.members.size || !this.current() || !isSynchronouslyTrue(this.original.canInteract) || !this.current() || !this.members.size || this.expanded === value) return;
    this.expanded = value; for (const listener of [...this.listeners]) listener();
  };
  toggle = () => this.setExpanded(!this.expanded);
}
export function useAdminProgressQrTechnicalMaterial(props: AdminProgressQrTechnicalMaterialProps) {
  if (!props.sectionIdentity || typeof props.sectionIdentity !== 'object' || Array.isArray(props.sectionIdentity) || typeof props.isCurrent !== 'function' || typeof props.canInteract !== 'function' || typeof props.p !== 'function' || !props.apparatusNamesById || typeof props.apparatusNamesById.get !== 'function') throw TypeError('Original technical section, canonical apparatus names and Source authority are required');
  // Catalog, report and locale redraws retain Source expansion; a native section never acquires another authority tuple.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lifetime = useMemo(() => new TechnicalSectionLifetime(props), [props.sectionIdentity]);
  const expanded = useSyncExternalStore(lifetime.subscribe, lifetime.getSnapshot, lifetime.getSnapshot);
  useLayoutEffect(() => lifetime.attach(), [lifetime]); useLayoutEffect(() => lifetime.commit(props));
  const visible = lifetime.matches(props) && lifetime.current();
  return { expanded, visible, title: props.p('worker.qr.report.technical'), rows: visible ? adminProgressQrTechnicalMaterial(props.report, props.apparatusNamesById, props.p) : [], toggle: lifetime.toggle, setExpanded: lifetime.setExpanded };
}
