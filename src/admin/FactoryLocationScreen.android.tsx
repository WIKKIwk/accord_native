import { DropdownMenu, DropdownMenuItem, IconButton, RNHostView, SnackbarHost, Text as ComposeText,
  useMaterialColors, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AdminApparatus } from '../apparatusApi';
import { BaseHost as Host } from '../components/BaseHost.android';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { localeController } from '../shared/localization/runtime';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import type { AdminFactoryLocation } from './factoryLocationModel';
import { factoryLocationApparatusLabels, factoryLocationNoticeText, factoryLocationScreenText } from './factoryLocationScreenModel';
import type { FactoryLocationScreenProps } from './factoryLocationScreenTypes';
import { useFactoryLocationScreen } from './useFactoryLocationScreen';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
function LocationRow({ location, apparatus, disabled, text, onEdit, onRename, onActive, first, last }: { location: AdminFactoryLocation;
  apparatus: readonly AdminApparatus[]; disabled: boolean; text: ReturnType<typeof factoryLocationScreenText>;
  onEdit: () => void; onRename: () => void; onActive: () => void; first: boolean; last: boolean }) {
  const [expanded, setExpanded] = useState(false), colors = useMaterialColors(), equipment = location.apparatus.length > 0;
  const names = factoryLocationApparatusLabels(location, apparatus);
  const choose = (action: () => void) => { setExpanded(false); requestAnimationFrame(action); };
  return <WorkerQueueCard first={first} last={last} backgroundColor={colors.surfaceContainerLowest}>
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onEdit} style={styles.rowBody}>
      <SymbolView name={{ android: equipment ? 'precision_manufacturing' : 'place' }} size={24}
        tintColor={location.active ? colors.primary : colors.onSurfaceVariant} importantForAccessibility="no" />
      <View style={styles.rowText}><Text style={[styles.name, { color: colors.onSurface }]}>{location.name}</Text>
        <Text selectable style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{location.id}</Text>
        <View style={styles.badges}><Text style={[styles.badge, { backgroundColor: equipment ? colors.primaryContainer : colors.surfaceContainerHighest,
          color: colors.onSurface }]}>{equipment ? text.equipment : text.ordinary}</Text>
          {!location.active ? <Text style={[styles.badge, { backgroundColor: colors.errorContainer, color: colors.onErrorContainer }]}>{text.inactive}</Text> : null}</View>
        {location.apparatus.length ? <Text style={{ color: colors.onSurfaceVariant }}>{names}</Text> : null}
      </View>
    </Pressable>
    <Host matchContents><DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
      <DropdownMenu.Trigger><IconButton enabled={!disabled} onClick={() => setExpanded(true)} modifiers={[semantics({ contentDescription: text.actions })]}>
        <RNHostView matchContents><SymbolView name={{ android: 'more_vert' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
      </IconButton></DropdownMenu.Trigger>
      <DropdownMenu.Items>
        <DropdownMenuItem onClick={() => choose(onEdit)}><DropdownMenuItem.Text><ComposeText>{text.edit}</ComposeText></DropdownMenuItem.Text></DropdownMenuItem>
        <DropdownMenuItem onClick={() => choose(onRename)}><DropdownMenuItem.Text><ComposeText>{text.rename}</ComposeText></DropdownMenuItem.Text></DropdownMenuItem>
        <DropdownMenuItem onClick={() => choose(onActive)}><DropdownMenuItem.Text><ComposeText>{location.active ? text.deactivate : text.activate}</ComposeText></DropdownMenuItem.Text></DropdownMenuItem>
      </DropdownMenu.Items>
    </DropdownMenu></Host>
  </WorkerQueueCard>;
}
export function FactoryLocationScreen(props: FactoryLocationScreenProps) {
  const state = useFactoryLocationScreen(props), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const text = factoryLocationScreenText(locale), { controller, navigation, footer } = props, colors = useMaterialColors(), insets = useSafeAreaInsets();
  const snackbar = useRef<SnackbarHostRef>(null), mounted = useRef(true), [refreshing, setRefreshing] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (state.notice) void snackbar.current?.showSnackbar({ message: factoryLocationNoticeText(state.notice, locale), duration: 'short' }); }, [state.notice, locale]);
  const refresh = async () => { setRefreshing(true); try { await controller.load(); } finally { if (mounted.current) setRefreshing(false); } };
  const openEditor = (id: string | null) => { const ticket = controller.beginEditor(id); if (ticket) props.onOpenEditor(ticket); };
  const rename = (id: string) => { const ticket = controller.beginEditor(id); if (ticket) props.onOpenRename(ticket); };
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }]}>
    <View style={styles.header}><View style={{ flex: 1 }}><RoleHeader title={text.title} navigation={navigation ?? undefined} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={text.create} disabled={state.saving || state.status === 'forbidden'} onPress={() => openEditor(null)} hitSlop={8} style={styles.add}>
        <SymbolView name={{ android: 'add_location_alt' }} size={24} tintColor={colors.onSurface} />
      </Pressable></View>
    {state.status === 'loading' ? <View style={styles.center}><ActivityIndicator /></View> :
      state.status === 'error' ? <View style={styles.error}><Text style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>{text.loadError}</Text>
        <Text accessibilityRole="button" onPress={() => { void controller.load(); }} style={[styles.retry, { color: colors.primary }]}>{text.retry}</Text></View> :
        state.status === 'ready' ? <FlatList data={state.locations} keyExtractor={item => item.id} style={styles.content}
          contentContainerStyle={{ flexGrow: 1, paddingTop: 10, paddingBottom: insets.bottom + 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} />}
          ListHeaderComponent={<View style={styles.create}><WorkerSheetButton label={text.create} variant="filled" disabled={state.saving}
            icon={{ ios: 'plus', android: 'add' }} onPress={() => openEditor(null)} /></View>}
          ListEmptyComponent={<View style={styles.empty}><SymbolView name={{ android: 'add_location_alt' }} size={48} tintColor={colors.onSurfaceVariant} />
            <Text style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>{text.empty}</Text></View>}
          renderItem={({ item, index }) => <LocationRow location={item} apparatus={state.apparatus} disabled={state.saving} text={text}
            first={index === 0} last={index === state.locations.length - 1} onEdit={() => openEditor(item.id)} onRename={() => rename(item.id)}
            onActive={() => { void controller.setActive(item.id, !item.active); }} />} /> : null}
    {footer}
    <View pointerEvents="none" style={[styles.snackbar, { bottom: insets.bottom + 16 }]}><Host matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></Host></View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center' },
  add: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 16 }, retry: { paddingHorizontal: 12, paddingVertical: 8, fontWeight: '600' },
  create: { paddingHorizontal: 8, paddingBottom: 10 }, empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 24, gap: 12 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, paddingStart: 8 }, rowText: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontWeight: '700' }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 12 }, snackbar: { position: 'absolute', left: 16, right: 16, bottom: 16 } });
