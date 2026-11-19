import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminShellTheme } from './useAdminShellTheme';
import { DropdownMenu, DropdownMenuItem, IconButton, RNHostView, SnackbarHost, Text as ComposeText, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { semantics, size } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AdminApparatus } from '../apparatusApi';
import { BaseHost as Host } from '../components/BaseHost.android';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { localeController } from '../shared/localization/runtime';
import { OrdersList } from '../shared/orders/OrdersList';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminScreenHeader } from './AdminTopBar.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import type { AdminFactoryLocation } from './factoryLocationModel';
import { factoryLocationApparatusLabels, factoryLocationNoticeText, factoryLocationScreenText } from './factoryLocationScreenModel';
import type { FactoryLocationScreenProps } from './factoryLocationScreenTypes';
import { useFactoryLocationScreen } from './useFactoryLocationScreen';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
const passthrough = () => true;
function LocationRow({ location, apparatus, disabled, text, onEdit, onRename, onActive, first, last }: { location: AdminFactoryLocation;
  apparatus: readonly AdminApparatus[]; disabled: boolean; text: ReturnType<typeof factoryLocationScreenText>;
  onEdit: () => void; onRename: () => void; onActive: () => void; first: boolean; last: boolean }) {
  const [expanded, setExpanded] = useState(false), colors = useBaseTheme().colors, equipment = location.apparatus.length > 0;
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
  const text = factoryLocationScreenText(locale), { controller, navigation, footer } = props, { colors, chromeBackground } = useAdminShellTheme(), insets = useSafeAreaInsets();
  const snackbar = useRef<SnackbarHostRef>(null), headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  useEffect(() => { if (state.notice) void snackbar.current?.showSnackbar({ message: factoryLocationNoticeText(state.notice, locale), duration: 'short' }); }, [state.notice, locale]);
  const openEditor = (id: string | null) => { const ticket = controller.beginEditor(id); if (ticket) props.onOpenEditor(ticket); };
  const rename = (id: string) => { const ticket = controller.beginEditor(id); if (ticket) props.onOpenRename(ticket); };
  return <View style={[styles.screen, { backgroundColor: chromeBackground, paddingTop: insets.top }]}>
    <AdminScreenHeader title={text.title} navigation={navigation} profileAction={props.profileAction}
      actions={<IconButton enabled={!state.saving && state.status !== 'forbidden'} onClick={() => openEditor(null)}
        modifiers={[size(48, 48), semantics({ contentDescription: text.create })]}>
        <RNHostView matchContents><SymbolView name={{ android: 'add_location_alt' }} size={24} tintColor={colors.onSurface} /></RNHostView>
      </IconButton>} />
    <AdminShellBodyFrame hasFooter={footer != null} testID="admin-factory-locations-body-frame">
    {state.status === 'loading' ? <View style={styles.center}><Host matchContents><AdminLoadingIndicator /></Host></View> :
      state.status === 'error' ? <View style={styles.error}><Text style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>{text.loadError}</Text>
        <WorkerSheetButton variant="text" label={text.retry} onPress={() => { void controller.load(); }} /></View> :
        state.status === 'ready' ? <OrdersList rows={state.locations} rowKey={item => item.id} active passthrough={passthrough}
          headerOffset={headerOffset} headerHeight={headerHeight} topInset={10} onRefresh={() => controller.load()}
          footer={<View style={{ height: insets.bottom + 120 }} />}
          renderRow={(item, index) => <LocationRow location={item} apparatus={state.apparatus} disabled={state.saving} text={text}
            first={index === 0} last={index === state.locations.length - 1} onEdit={() => openEditor(item.id)} onRename={() => rename(item.id)}
            onActive={() => { void controller.setActive(item.id, !item.active); }} />}>
          <View style={styles.create}><WorkerSheetButton label={text.create} variant="filled" disabled={state.saving}
            icon={{ ios: 'plus', android: 'add' }} onPress={() => openEditor(null)} /></View>
          {!state.locations.length && <View style={styles.empty}><SymbolView name={{ android: 'add_location_alt' }} size={48} tintColor={colors.onSurfaceVariant} />
            <Text style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>{text.empty}</Text></View>}
        </OrdersList> : null}
    </AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}>{footer}</View>
    <View pointerEvents="none" style={[styles.snackbar, { bottom: insets.bottom + 16 }]}><Host matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></Host></View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 16 },
  create: { paddingHorizontal: 8, paddingBottom: 10 }, empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 24, gap: 12 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, paddingStart: 8 }, rowText: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontWeight: '700' }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 12 }, snackbar: { position: 'absolute', left: 16, right: 16, bottom: 16 } });
