import { createContext, useCallback, useContext, useState } from 'react';

export const RoleDrawerContext = createContext<{ open: () => void; close: () => void } | null>(null);

export function useRoleDrawer() {
  const drawer = useContext(RoleDrawerContext);
  if (!drawer) throw new Error('useRoleDrawer must be used inside RoleDrawer');
  return drawer;
}

export function useRoleDrawerState() {
  const [visible, setVisible] = useState(false);
  const onOpen = useCallback(() => setVisible(true), []);
  const onClose = useCallback(() => setVisible(false), []);
  return { visible, onOpen, onClose };
}
