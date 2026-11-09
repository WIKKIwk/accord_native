import { useEffect } from 'react';
import { PlatformColor, Text, View } from 'react-native';

export function CustomerSnackbar({ message, messageId, onDismiss }: { message: string; messageId: number | null; onDismiss: () => void }) {
  useEffect(() => { if (!message) return; const timer = setTimeout(onDismiss, 4000); return () => clearTimeout(timer); }, [message, messageId, onDismiss]);
  if (!message) return null;
  return <View accessibilityRole="alert" style={{ position: 'absolute', left: 16, right: 16, bottom: 20,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 8, backgroundColor: PlatformColor('secondarySystemBackground') }}>
    <Text style={{ color: PlatformColor('label') }}>{message}</Text>
  </View>;
}
