import { Host, TextInput, useNativeState } from '@expo/ui';
import { SymbolView } from 'expo-symbols';
import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { localeController } from '../shared/localization/runtime';
import type { FactoryLocationEditorProps } from './factoryLocationEditorTypes';
import { useFactoryLocationEditor } from './useFactoryLocationEditor';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
/** Content only. A real native dialog host must render its title and dismiss it before submitting. */
export function FactoryLocationEditorContent(props: FactoryLocationEditorProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), editor = useFactoryLocationEditor(props, locale);
  const colors = useWorkerColors(), input = useNativeState(props.ticket.location?.name ?? '');
  if (editor.stale) return null;
  return <View style={styles.content}>
    <Text style={[styles.label, { color: colors.muted }]}>{editor.text.name}</Text>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><TextInput value={input} onChangeText={editor.setName}
      placeholder={editor.text.name} accessibilityLabel={editor.text.name} editable={!props.ticket.location && !editor.pickerOpen}
      autoFocus={!props.ticket.location} returnKeyType="next"
      style={{ width: '100%', borderWidth: 1, borderColor: colors.muted, borderRadius: 4, padding: 12 }} /></Host>
    {editor.text.note ? <Text style={{ color: colors.muted }}>{editor.text.note}</Text> : null}
    <WorkerSheetButton label={editor.text.attach} disabled={editor.pickerOpen} icon={{ ios: 'link.badge.plus', android: 'add_link' }}
      onPress={() => { void editor.openPicker(); }} />
    {editor.visibleSelected.length === 0 ? <Text style={{ color: colors.muted }}>{editor.text.empty}</Text> :
      <View style={styles.chips}>{editor.visibleSelected.map((item, index) => <View key={`${index}:${item.id}`} style={[styles.chip, { backgroundColor: colors.field }]}>
        <Text style={{ color: colors.text }}>{item.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={editor.text.deleteTooltip} disabled={editor.pickerOpen}
          onPress={() => editor.remove(item.id)} hitSlop={6}>
          <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel' }} size={20} tintColor={colors.muted} />
        </Pressable>
      </View>)}</View>}
    <WorkerSheetButton label={editor.text.save} variant="filled" height={52} disabled={editor.pickerOpen} onPress={editor.submit} />
    <WorkerSheetButton label={editor.text.cancel} variant="text" height={52} disabled={editor.pickerOpen} onPress={editor.cancel} />
  </View>;
}
const styles = StyleSheet.create({ content: { gap: 8 }, label: { fontSize: 13 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, gap: 6 } });
