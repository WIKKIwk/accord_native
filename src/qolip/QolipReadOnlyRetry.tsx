import { Button, Host } from '@expo/ui';
import { StyleSheet, Text, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { localizedGetter } from '../shared/localization';
import { useQolipText } from './useQolipText';

/** V2 AppRetryState, with a truthful load-failure message when guarded refresh is unavailable. */
export function QolipReadOnlyRetry({ refreshUnavailable, onRetry }: { refreshUnavailable?: boolean; onRetry: () => void }) {
  const { locale, text } = useQolipText(), theme = useBaseTheme();
  return <View style={styles.root}><View style={styles.content}>
    <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>{refreshUnavailable
      ? text('home.load_failed') : localizedGetter('serverDisconnectedRetry', locale)}</Text>
    <Host matchContents style={styles.button}>
      <Button label={localizedGetter('retry', locale)} variant="text" onPress={onRetry} />
    </Host>
  </View></View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  content: { width: '100%', maxWidth: 360, alignItems: 'center' },
  message: { textAlign: 'center', fontSize: 16, lineHeight: 22 },
  button: { marginTop: 16 },
});
