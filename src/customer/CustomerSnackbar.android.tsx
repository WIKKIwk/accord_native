import { Host, SnackbarHost, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

export function CustomerSnackbar({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const host = useRef<SnackbarHostRef>(null);
  useEffect(() => {
    if (!message || !host.current) return;
    let active = true;
    void host.current.showSnackbar({ message, duration: 'short' }).finally(() => { if (active) onDismiss(); });
    return () => { active = false; };
  }, [message, onDismiss]);
  return <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><SnackbarHost ref={host} /></Host>
  </View>;
}
