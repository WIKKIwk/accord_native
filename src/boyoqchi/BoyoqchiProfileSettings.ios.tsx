import { Button, Host } from '@expo/ui/swift-ui';
import { labelStyle } from '@expo/ui/swift-ui/modifiers';
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createBoyoqchiProfileSettingsSlot, type BoyoqchiProfileSettingsSlot } from './boyoqchiProfileSettingsSlot';
import { useBoyoqchiGetter } from './useBoyoqchiText';

const Context = createContext<BoyoqchiProfileSettingsSlot | null>(null);
export function BoyoqchiProfileSettingsProvider({ children }: { children: ReactNode }) {
  const [slot] = useState(createBoyoqchiProfileSettingsSlot);
  return <Context.Provider value={slot}>{children}</Context.Provider>;
}
export function useBoyoqchiProfileSettings() {
  const slot = useContext(Context);
  if (!slot) throw new Error('Boyoqchi Profile settings unavailable');
  return slot;
}
export function BoyoqchiProfileSettingsButton() {
  const slot = useBoyoqchiProfileSettings(), getter = useBoyoqchiGetter();
  const handle = useSyncExternalStore(slot.subscribe, slot.getSnapshot, slot.getSnapshot);
  if (!handle) return null;
  return <Host matchContents><Button label={getter('profileSettingsTitle')} systemImage="slider.horizontal.3"
    modifiers={[labelStyle('iconOnly')]} onPress={handle.open} /></Host>;
}
