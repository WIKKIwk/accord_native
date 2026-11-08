import { TextInput, useNativeState } from '@expo/ui';
import { Button, RNHostView, Text as ComposeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useSyncExternalStore } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { BaseHost as Host } from '../components/BaseHost.android';
import { WorkerIconButton } from '../components/WorkerIconButton.android';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { FactoryApparatusPickerProps } from './factoryApparatusPickerTypes';
import { useFactoryApparatusPicker } from './useFactoryApparatusPicker';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function FactoryApparatusPicker(props: FactoryApparatusPickerProps) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), picker = useFactoryApparatusPicker(props, locale);
  const search = useNativeState(''), colors = useMaterialColors();
  return <View style={[styles.screen, { backgroundColor: colors.surface }]}>
    <View style={styles.header}><Text style={[styles.title, { color: colors.onSurface }]}>{picker.text.title}</Text>
      <WorkerIconButton icon="close" label={localizedGetter('closeAction', locale)} onPress={props.onCancel} />
    </View>
    <View style={styles.search}><SymbolView name={{ android: 'search' }} size={24} tintColor={colors.onSurfaceVariant} importantForAccessibility="no" />
      <Host matchContents={{ vertical: true }} style={{ flex: 1 }}>
        <TextInput value={search} onChangeText={picker.setQuery} placeholder={picker.text.search} accessibilityLabel={picker.text.search}
          autoCapitalize="none" style={{ width: '100%', borderWidth: 1, borderColor: colors.onSurfaceVariant, borderRadius: 4, padding: 12 }} />
      </Host></View>
    <FlatList data={picker.rows} keyExtractor={item => item.key} keyboardShouldPersistTaps="handled" style={styles.list}
      contentContainerStyle={styles.listContent} ListEmptyComponent={<Text style={[styles.empty, { color: colors.onSurfaceVariant }]}>{picker.text.empty}</Text>}
      renderItem={({ item }) => item.kind === 'heading' ? <Text style={[styles.heading, { color: colors.primary }]}>{item.title}</Text>
        : <WorkerQueueCard backgroundColor={picker.selected.has(item.item.id) ? colors.primaryContainer : colors.surface}
          onPress={() => picker.toggle(item.item.id)}>
          <SymbolView name={{ android: picker.selected.has(item.item.id) ? 'check_circle' : 'radio_button_unchecked' }}
            size={24} tintColor={picker.selected.has(item.item.id) ? colors.primary : colors.onSurfaceVariant} importantForAccessibility="no" />
          <Text style={[styles.rowText, { color: colors.onSurface }]}>{item.item.name}</Text>
        </WorkerQueueCard>} />
    <View style={styles.confirm}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Button onClick={picker.confirm} modifiers={[fillMaxWidth()]}>
        <RNHostView matchContents><SymbolView name={{ android: 'check' }} size={20} tintColor={colors.onPrimary} importantForAccessibility="no" /></RNHostView>
        <ComposeText>{picker.text.confirm}</ComposeText>
      </Button>
    </Host></View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingTop: 14 },
  title: { flex: 1, fontSize: 22, fontWeight: '800' },
  search: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }, list: { flex: 1 }, listContent: { flexGrow: 1, paddingHorizontal: 4, paddingBottom: 8 },
  heading: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, fontWeight: '700' }, rowText: { flex: 1, marginStart: 12, fontSize: 16 },
  empty: { textAlign: 'center', marginTop: 40 }, confirm: { paddingHorizontal: 16, paddingVertical: 8 } });
