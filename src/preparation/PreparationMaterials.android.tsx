import { Checkbox, Column, Host, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { clickable, fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text as NativeText, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { useNativeSheet } from '../nativeSheet';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { OrdersList } from '../shared/orders/OrdersList';
import { usePreparationContext } from './PreparationContext.android';
import { usePreparationFab } from './PreparationFab.android';
import { PreparationNotice } from './PreparationNotice';
import { PreparationButton, PreparationDock, PreparationField, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { preparationMaterialDeleteMessage, preparationMaterialsEmptyMessage, preparationMaterialsErrorMessage } from './usePreparationMaterials';
import { usePreparationMaterialsView } from './usePreparationAndroidView.android';
import { usePreparationNotice } from './usePreparationNotice';

type Choices = { name: string; editable: boolean; selected: boolean }[];
type MaterialAction = 'rename' | 'warehouses' | 'delete';

function MaterialRow({ name, subtitle, blocked, open, first, last }: { name: string; subtitle: string; blocked: boolean; open: () => void; first: boolean; last: boolean }) {
  const colors = useMaterialColors();
  return <WorkerQueueCard backgroundColor={colors.surface} first={first} last={last} onPress={blocked ? undefined : open}>
    <View accessible={false} style={[styles.materialIcon, { backgroundColor: colors.surfaceContainerHighest }]}>
      <SymbolView name={{ android: 'inventory_2' }} size={20} tintColor={colors.onSurfaceVariant} />
    </View>
    <View style={styles.materialText}>
      <NativeText numberOfLines={1} style={[styles.headline, { color: colors.onSurface }]}>{name}</NativeText>
      <NativeText numberOfLines={1} style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{subtitle}</NativeText>
    </View>
    <SymbolView name={{ android: 'more_vert' }} size={24} tintColor={colors.onSurfaceVariant} />
  </WorkerQueueCard>;
}

const passthroughListItems = () => true;

function MaterialActions({ name, choose }: { name: string; choose: (action: MaterialAction) => void }) {
  const t = usePreparationText();
  return <View style={{ padding: 16, gap: 10 }}><PreparationText title>{name}</PreparationText>
    <PreparationRow title={t('Nomini o‘zgartirish')} onPress={() => choose('rename')} />
    <PreparationRow title={t('Omborga biriktirish')} onPress={() => choose('warehouses')} />
    <PreparationRow title={t('O‘chirish')} onPress={() => choose('delete')} />
  </View>;
}

function AssignmentSheet({ name, choices, save }: { name: string; choices: Choices; save: (selected: string[]) => void }) {
  const t = usePreparationText();
  const initial = choices.filter(choice => choice.selected).map(choice => choice.name).sort();
  const [selected, setSelected] = useState(initial);
  const changed = JSON.stringify([...selected].sort()) !== JSON.stringify(initial);
  const toggle = (name: string, value: boolean) => setSelected(current => value
    ? current.includes(name) ? current : [...current, name] : current.filter(entry => entry !== name));
  return <View style={{ padding: 16, gap: 12 }}>
    <PreparationText title>{t('Omborga biriktirish')}</PreparationText><PreparationText>{name}</PreparationText>
    {choices.length === 0 ? <PreparationText>{t('Sizga exclusive ombor biriktirilmagan.')}</PreparationText> : null}
    {choices.map(choice => <Host key={choice.name} matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), ...(choice.editable
        ? [clickable(() => toggle(choice.name, !selected.includes(choice.name)))] : [])]}>
        <Checkbox value={selected.includes(choice.name)} enabled={choice.editable}
          onCheckedChange={value => toggle(choice.name, value)} />
        <Column><Text>{choice.name}</Text>{!choice.editable ? <Text>{t('Bu biriktirishni faqat administrator o‘zgartira oladi')}</Text> : null}</Column>
      </Row>
    </Host>)}
    <PreparationText>{t('Bu amal ombordagi qoldiqni ko‘chirmaydi.')}</PreparationText>
    <PreparationButton label="Saqlash" disabled={!changed} onPress={() => save([...selected].sort())} />
  </View>;
}

// @v2 PreparationMaterialsScreen
export function PreparationMaterialsScreen() {
  const { session } = usePreparationContext(), state = usePreparationMaterialsView(session), dialogs = usePreparationDialogs(), t = usePreparationText();
  const colors = useMaterialColors(), insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const setDockHeight = usePreparationFab(null, { actions: [], onSelect: () => {}, enabled: false, visible: true,
    openLabel: t('Amallarni ochish'), closeLabel: t('Amallarni yopish') });
  const actionSheet = useNativeSheet(), assignmentSheet = useNativeSheet(), notice = usePreparationNotice();
  const afterAction = useRef<(() => void) | null>(null), afterAssignment = useRef<(() => void) | null>(null);
  const blocked = state.actionsBlocked;
  const failure = (error: unknown) => notice.show(t(preparationMaterialsErrorMessage(error)));
  const perform = async (item: typeof state.items[number], action: MaterialAction) => {
    try {
      if (action === 'rename') {
        const name = await dialogs.input({ title: 'Homashyo nomini o‘zgartirish', label: 'Homashyo nomi', initial: item.name });
        if (name !== null && await state.controller.rename(item, name)) notice.show(t('Homashyo nomi o‘zgartirildi'));
      } else if (action === 'delete') {
        const confirmed = await dialogs.confirm('Homashyoni o‘chirish', preparationMaterialDeleteMessage(item.name), 'O‘chirish');
        if (confirmed && await state.controller.remove(item)) notice.show(t('Homashyo o‘chirildi'));
      } else {
        const choices = await state.controller.warehouseChoices(item);
        if (!choices) return;
        assignmentSheet.open(<AssignmentSheet name={item.name} choices={choices} save={selected => {
          afterAssignment.current = () => { void state.controller.setWarehouses(item, selected)
            .then(saved => { if (saved) notice.show(t('Ombor biriktirish yangilandi')); }).catch(failure); };
          assignmentSheet.close();
        }} />, { compact: true, dismissible: true, onDismiss: () => {
          const next = afterAssignment.current; afterAssignment.current = null; next?.();
        } });
      }
    } catch (error) { failure(error); }
  };
  const openActions = (item: typeof state.items[number]) => {
    if (blocked) return;
    actionSheet.open(<MaterialActions name={item.name} choose={action => {
      afterAction.current = () => { void perform(item, action); }; actionSheet.close();
    }} />, { compact: true, dismissible: true, onDismiss: () => {
      const next = afterAction.current; afterAction.current = null; next?.();
    } });
  };
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <RoleHeader title={t('Homashyolar')} navigation={{ icon: 'back', label: t('Orqaga'), onPress: () => {
      if (router.canGoBack()) router.back(); else router.replace('/android-preparation' as Href);
    } }} />
    <OrdersList active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} passthrough={passthroughListItems}
      onRefresh={async () => { await state.controller.load(true); }}>
    <View style={styles.field}><PreparationField label="Homashyoni qidirish" initial={state.query} onChange={value => state.controller.setQuery(value)} /></View>
    {(state.loading && !state.items.length) || state.saving ? <ActivityIndicator /> : null}
    {state.error ? <><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => void state.controller.load()} /></> : null}
    {!state.loading && !state.filtered.length && !state.error ? <PreparationText>{t(preparationMaterialsEmptyMessage(state.query))}</PreparationText> : null}
    {state.filtered.map((item, index) => <MaterialRow key={item.item_code} name={item.name}
      subtitle={item.warehouses.length ? item.warehouses.join(', ') : t('Ombor biriktirilmagan')}
      blocked={blocked} first={index === 0} last={index === state.filtered.length - 1} open={() => openActions(item)} />)}
    </OrdersList>
    <View onLayout={event => setDockHeight(event.nativeEvent.layout.height)}><PreparationDock /></View>
    <PreparationNotice message={notice.message} />
  </View>;
}

const styles = StyleSheet.create({
  field: { padding: 16 },
  materialIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  materialText: { flex: 1, marginStart: 16 },
  headline: { fontSize: 16, lineHeight: 24, includeFontPadding: false, fontWeight: '500' },
  supporting: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
});
