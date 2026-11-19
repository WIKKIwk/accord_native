import { TextInput, useNativeState } from '@expo/ui';
import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BaseHost } from '../components/BaseHost';
import { useBaseTheme } from '../components/useBaseTheme';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { localeController } from '../shared/localization/runtime';
import type { FactoryLocationRenameProps } from './factoryLocationRenameTypes';
import { useFactoryLocationRename } from './useFactoryLocationRename';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
/** Content only. The actual dialog host displays the title and closes before the guarded mutation. */
export function FactoryLocationRenameContent(props: FactoryLocationRenameProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), rename = useFactoryLocationRename(props, locale);
  const colors = useBaseTheme().colors, input = useNativeState(props.ticket.location?.name ?? '');
  if (rename.stale) return null;
  return <View style={styles.content}>
    <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{rename.text.name}</Text>
    <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><TextInput value={input} onChangeText={rename.setName}
      placeholder={rename.text.name} accessibilityLabel={rename.text.name} autoFocus
      style={{ width: '100%', borderWidth: 1, borderColor: colors.onSurfaceVariant, borderRadius: 4, padding: 12 }} /></BaseHost>
    <View style={styles.actions}>
      <View style={styles.action}><WorkerSheetButton label={rename.text.cancel} variant="text" onPress={rename.cancel} /></View>
      <View style={styles.action}><WorkerSheetButton label={rename.text.save} variant="filled" onPress={rename.submit} /></View>
    </View>
  </View>;
}
const styles = StyleSheet.create({ content: { gap: 8 }, label: { fontSize: 13 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  action: { minWidth: 88 } });
