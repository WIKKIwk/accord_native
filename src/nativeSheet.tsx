import { router } from 'expo-router';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, type ContextType, type ReactNode } from 'react';
import { SecurityContext } from './components/WorkerSecurity';

export type NativeSheetOptions = {
  presentation?: 'sheet' | 'page';
  onDismiss?: () => void;
  compact?: boolean;
  fitContent?: boolean;
  dismissible?: boolean;
  heightFraction?: number;
};

type SheetSnapshot = {
  content: ReactNode;
  options: NativeSheetOptions;
  security: ContextType<typeof SecurityContext>;
  closing: boolean;
};

type SheetOwner = { id: string | null; mounted: boolean };
type SheetEntry = {
  snapshot: SheetSnapshot;
  owner: SheetOwner;
  listeners: Set<() => void>;
  mounts: number;
  pop?: () => void;
};

const sheets = new Map<string, SheetEntry>();
let nextId = 0;

function ownedEntry(owner: SheetOwner) {
  const entry = owner.id ? sheets.get(owner.id) : undefined;
  return entry?.owner === owner ? entry : undefined;
}

function publish(entry: SheetEntry, snapshot: SheetSnapshot) {
  entry.snapshot = snapshot;
  entry.listeners.forEach(listener => listener());
}

function closeEntry(entry: SheetEntry, force = false) {
  if (entry.snapshot.closing) {
    if (force) publish(entry, { ...entry.snapshot, content: null });
    return;
  }
  publish(entry, { ...entry.snapshot, closing: true, content: force ? null : entry.snapshot.content });
  entry.pop?.();
}

function finishEntry(id: string, entry: SheetEntry) {
  if (sheets.get(id) !== entry) return;
  sheets.delete(id);
  if (entry.owner.id === id) entry.owner.id = null;
  entry.listeners.forEach(listener => listener());
  entry.listeners.clear();
  if (entry.owner.mounted) entry.snapshot.options.onDismiss?.();
}

export function getNativeSheet(id: string) {
  return sheets.get(id)?.snapshot ?? null;
}

export function subscribeNativeSheet(id: string, listener: () => void) {
  const entry = sheets.get(id);
  entry?.listeners.add(listener);
  return () => { entry?.listeners.delete(listener); };
}

export function closeNativeSheet(id: string) {
  const entry = sheets.get(id);
  if (entry) closeEntry(entry);
}

export function mountNativeSheet(id: string, pop: () => void) {
  const entry = sheets.get(id);
  if (!entry) return () => {};
  entry.mounts++;
  entry.pop = pop;
  if (entry.snapshot.closing) pop();
  return () => {
    entry.mounts--;
    if (entry.pop === pop) entry.pop = undefined;
    // React StrictMode reattaches effects before this microtask runs.
    queueMicrotask(() => {
      if (entry.mounts === 0) finishEntry(id, entry);
    });
  };
}

export function useNativeSheet() {
  const security = useContext(SecurityContext);
  const latestSecurity = useRef(security);
  const owner = useRef<SheetOwner>({ id: null, mounted: true });

  useLayoutEffect(() => {
    latestSecurity.current = security;
    const entry = ownedEntry(owner.current);
    if (entry && entry.snapshot.security !== security) publish(entry, { ...entry.snapshot, security });
  }, [security]);

  useEffect(() => {
    const current = owner.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      queueMicrotask(() => {
        if (current.mounted || !current.id) return;
        const entry = ownedEntry(current);
        if (entry) closeEntry(entry, true);
      });
    };
  }, []);

  return useMemo(() => ({
    open(content: ReactNode, options: NativeSheetOptions = {}) {
      const current = owner.current;
      if (!current.mounted || ownedEntry(current)) return;
      const id = String(++nextId);
      current.id = id;
      const entry: SheetEntry = {
        snapshot: { content, options, security: latestSecurity.current, closing: false },
        owner: current,
        listeners: new Set(),
        mounts: 0,
      };
      sheets.set(id, entry);
      try {
        router.push({ pathname: options.presentation === 'page' ? '/page/[id]' : '/sheet/[id]', params: { id } });
      } catch (error) {
        sheets.delete(id);
        current.id = null;
        throw error;
      }
    },
    update(content: ReactNode, options?: NativeSheetOptions) {
      const entry = ownedEntry(owner.current);
      if (!entry || entry.snapshot.closing) return;
      publish(entry, { ...entry.snapshot, content,
        options: options ? { ...entry.snapshot.options, ...options } : entry.snapshot.options,
        security: latestSecurity.current,
      });
    },
    close() {
      const entry = ownedEntry(owner.current);
      if (entry) closeEntry(entry);
    },
    isOpen() {
      return !!ownedEntry(owner.current);
    },
  }), []);
}
