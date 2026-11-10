import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { RezkaScannerPreview } from '../rezka/RezkaScannerPreview';

/** Camera bridge only; the native detail screens own its position and actions. */
export function WorkerPaddonCamera({ enabled, current, accept }: { enabled: boolean; current(): boolean; accept(qr: string): void }) {
  const [focused, setFocused] = useState(false), [foreground, setForeground] = useState(!AppState.currentState || AppState.currentState === 'active');
  const [generation, setGeneration] = useState(0);
  useFocusEffect(useCallback(() => { setFocused(true); setGeneration(value => value + 1); return () => setFocused(false); }, []));
  useEffect(() => { const sub = AppState.addEventListener('change', value => { setForeground(value === 'active'); if (value === 'active') setGeneration(value => value + 1); }); return () => sub.remove(); }, []);
  return <View style={{ height: 240, borderRadius: 18, overflow: 'hidden' }}><RezkaScannerPreview active={enabled && focused && foreground}
    generation={generation} isCurrent={() => enabled && focused && foreground && current()} accept={accept} /></View>;
}
