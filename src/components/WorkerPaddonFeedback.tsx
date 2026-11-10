import { Text } from '@expo/ui';
import { View } from 'react-native';
import { BaseHost } from './BaseHost';
import { useWorkerColors } from './useWorkerColors';

/** V2's four-second snackbar; it does not take focus or require a dialog action. */
export function WorkerPaddonFeedback({ message }: { message: string }) {
  const colors = useWorkerColors();
  return message ? <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 16, right: 16, bottom: 100, padding: 16, borderRadius: 12, backgroundColor: colors.surface }}>
    <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Text>{message}</Text></BaseHost>
  </View> : null;
}
