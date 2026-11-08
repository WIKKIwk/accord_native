import type { MenuAction } from '@expo/ui/community/menu';
import type { SFSymbol } from 'expo-symbols';
import { isSynchronouslyTrue } from '../camera/synchronousGuard';

export type RoleFabAction = Readonly<{ id: string; label: string; icon: SFSymbol; width: number; disabled?: boolean }>;
export type RoleFabPresentation = Readonly<{ key: string; fingerprint: string; menuActions: MenuAction[];
  resolve: (eventId: string) => string | undefined }>;
let revision = 0;

function snapshotActions(actions: readonly RoleFabAction[]): { fingerprint: string; entries: RoleFabAction[] } | null {
  try {
    if (!Array.isArray(actions)) return null;
    const seen = new Set<string>(), entries: RoleFabAction[] = [];
    for (const item of actions) {
      if (!item) return null;
      const { id, label, icon, width, disabled } = item;
      if (typeof id !== 'string' || !id.trim() || seen.has(id) || typeof label !== 'string' || !label.trim() ||
          typeof icon !== 'string' || !icon.trim() || typeof width !== 'number' || !Number.isFinite(width) || width <= 0 ||
          (disabled !== undefined && typeof disabled !== 'boolean')) return null;
      seen.add(id); entries.push({ id, label, icon: icon as SFSymbol, width, disabled });
    }
    return { fingerprint: JSON.stringify(entries.map(item => [item.id, item.label, item.icon, item.width, item.disabled === true])), entries };
  } catch { return null; }
}

/** A render fingerprint changes when any user-visible action changes. */
export function roleFabFingerprint(actions: readonly RoleFabAction[]): string | null { return snapshotActions(actions)?.fingerprint ?? null; }

/** IDs used by the native menu are per-presentation, so an old event cannot target a new same-ID item. */
export function createRoleFabPresentation(actions: readonly RoleFabAction[]): RoleFabPresentation | null {
  const snapshot = snapshotActions(actions);
  if (!snapshot || !snapshot.entries.length || revision >= Number.MAX_SAFE_INTEGER) return null;
  const key = `role-fab-${++revision}`, eventIds = new Map<string, string>(), disabled = new Set<string>();
  const menuActions = snapshot.entries.map((item, index) => {
    const eventId = `${key}-${index}`; eventIds.set(eventId, item.id);
    if (item.disabled === true) disabled.add(eventId);
    return Object.freeze({ id: eventId, title: item.label, image: item.icon,
      ...(item.disabled ? { attributes: Object.freeze({ disabled: true }) } : {}) });
  });
  Object.freeze(menuActions);
  return Object.freeze({ key, fingerprint: snapshot.fingerprint, menuActions,
    resolve: (eventId: string) => disabled.has(eventId) ? undefined : eventIds.get(eventId) });
}

/** A closed gate never reactivates. Only a committed component effect creates a fresh gate. */
export function createRoleFabGate(presentation: RoleFabPresentation, isCurrent: () => boolean, onSelect: (id: string) => void) {
  let active = true, selecting = false;
  return {
    invalidate: () => { active = false; },
    select: (menuKey: string, eventId: unknown) => {
      if (!active || selecting || menuKey !== presentation.key || typeof eventId !== 'string') return;
      selecting = true;
      try {
        const id = presentation.resolve(eventId);
        if (id === undefined || !isSynchronouslyTrue(isCurrent) || !active) return;
        onSelect(id);
      } finally { selecting = false; }
    },
  };
}

/** External store binds native menu identity to each committed component lifecycle. */
export function createRoleFabStore(actions: readonly RoleFabAction[], resetKey: string,
  isCurrent: () => boolean, onSelect: (id: string) => void, fingerprint: string | null) {
  const listeners = new Set<() => void>();
  let entry: Readonly<{ presentation: RoleFabPresentation; gate: ReturnType<typeof createRoleFabGate> }> | null = null;
  const publish = () => { for (const listener of listeners) listener(); };
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => entry,
    activate: () => {
      entry?.gate.invalidate(); entry = null;
      if (typeof resetKey === 'string' && !!resetKey && fingerprint !== null &&
          typeof isCurrent === 'function' && typeof onSelect === 'function') {
        const presentation = createRoleFabPresentation(actions);
        if (presentation && presentation.fingerprint === fingerprint) {
          const gate = createRoleFabGate(presentation, () => roleFabFingerprint(actions) === fingerprint &&
            isSynchronouslyTrue(isCurrent) && roleFabFingerprint(actions) === fingerprint, onSelect);
          entry = Object.freeze({ presentation, gate });
        }
      }
      publish();
    },
    invalidate: () => { entry?.gate.invalidate(); entry = null; publish(); },
  };
}
