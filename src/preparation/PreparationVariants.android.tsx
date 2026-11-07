import { AlertDialog, Column, Host, OutlinedTextField, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { OrdersList } from '../shared/orders/OrdersList';
import { usePreparationContext } from './PreparationContext.android';
import { usePreparationFab } from './PreparationFab.android';
import { PreparationFormulaMenu, type FormulaMenuAction } from './PreparationFormulaMenu.android';
import { PreparationNotice } from './PreparationNotice';
import { openPreparationFormula, readPreparationRouteData } from './preparationNavigation.android';
import { PreparationButton, PreparationDock, PreparationPage, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { preparationVariantNameCanSave } from './usePreparationLibrary';
import { usePreparationVariantsView } from './usePreparationAndroidView.android';
import { preparationFormulaErrorMessage } from './usePreparationFormula';
import { preparationCatalogSubtitle } from './preparationLibraryPresentation';
import type { PreparationVariantsOptions, PreparationVariantsState } from './usePreparationVariants';
import { usePreparationReusePicker } from './usePreparationReusePicker.android';
import { preparationVariantRemoveMessage, preparationVariantRemovedMessage, preparationVariantSubtitle } from './preparationVariantPresentation';
import { usePreparationNotice } from './usePreparationNotice';

type Options = PreparationVariantsOptions & { orderCode: string; productTitle: string; materialName: string; customerName?: string };
type Variant = ReturnType<typeof usePreparationVariantsView>['variants'][number];
type VariantAction = FormulaMenuAction;
const variantActions: readonly VariantAction[] = ['edit', 'delete', 'rename'];
const passthroughListItems = () => true;

function VariantRow({ title, subtitle, disabled = false, first, last, onPress, onAction }: {
  title: string; subtitle: string; disabled?: boolean; first: boolean; last: boolean; onPress: () => void; onAction?: (action: VariantAction) => void;
}) {
  const colors = useMaterialColors();
  return <WorkerQueueCard backgroundColor={colors.surface} first={first} last={last}
    onPress={disabled ? undefined : onPress}>
    <View accessible={false} style={[styles.icon, { backgroundColor: colors.surfaceContainerHighest }]}>
      <SymbolView name={{ android: 'functions' }} size={20} tintColor={colors.onSurfaceVariant} />
    </View>
    <View style={styles.rowText}>
      <NativeText style={[styles.headline, { color: colors.onSurface }]}>{title}</NativeText>
      <NativeText style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{subtitle}</NativeText>
    </View>
    {onAction ? <PreparationFormulaMenu name={title} disabled={disabled} actions={variantActions} onSelect={onAction} /> : null}
  </WorkerQueueCard>;
}

function ReusePicker({ controller, close, choose }: { controller: PreparationVariantsState; close: () => void; choose: (id: string) => void }) {
  const picker = usePreparationReusePicker(controller), query = useNativeState(''), t = usePreparationText();
  return <WorkerOrderSheet onClose={close} dismissible>
    <View style={{ flex: 1, paddingTop: 8, gap: 12 }}>
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <PreparationText title>{t('Shnek formulasini tanlang')}</PreparationText>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField value={query} singleLine autoFocus
        onValueChange={picker.setQuery} modifiers={[fillMaxWidth(), testID('preparation-variant-reuse-search')]}>
        <OutlinedTextField.Label><Text>{t('Formula nomi, kodi yoki buyurtmani qidirish')}</Text></OutlinedTextField.Label>
      </OutlinedTextField></Host>
      </View>
      <FlatList data={picker.items} keyExtractor={item => item.id} nestedScrollEnabled keyboardShouldPersistTaps="handled"
        onEndReached={picker.loadMore} onEndReachedThreshold={0.4}
        renderItem={({ item, index }) => <VariantRow title={item.name} subtitle={preparationCatalogSubtitle(item)}
          first={index === 0} last={index === picker.items.length - 1} onPress={() => choose(item.id)} />}
        contentContainerStyle={{ paddingBottom: 8, flexGrow: 1 }}
        ListEmptyComponent={!picker.loading && !picker.error ? <View style={styles.context}><PreparationText>{t('Formula topilmadi.')}</PreparationText></View> : undefined}
        ListFooterComponent={<>{picker.loading ? <ActivityIndicator /> : null}
          {picker.error ? <View style={styles.context}><PreparationText>{picker.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={picker.retry} /></View> : null}</>} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}><PreparationButton label="Bekor qilish" onPress={close} /></View>
    </View>
  </WorkerOrderSheet>;
}

// @v2 _VariantNameDialog
export function VariantNameDialog({ initial, busy, error, submit, cancel, orderScoped = false, clearError }: { initial?: string; busy: boolean; error: string | null;
  submit: (name: string) => void; cancel: () => void; orderScoped?: boolean; clearError?: () => void }) {
  const { width, height } = useWindowDimensions(), t = usePreparationText();
  const nativeValue = useNativeState(initial ?? ''), [value, setValue] = useState(initial ?? '');
  const close = () => { if (!busy) cancel(); };
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={close} properties={{ dismissOnBackPress: !busy, dismissOnClickOutside: !busy }}>
      <AlertDialog.Title><Text>{t(initial ? 'Nomini o‘zgartirish' : 'Shnek variantiga nom bering')}</Text></AlertDialog.Title>
      <AlertDialog.Text><Column verticalArrangement={{ spacedBy: 8 }}><OutlinedTextField value={nativeValue} enabled={!busy} singleLine autoFocus maxLength={160}
        onValueChange={next => { setValue(next); clearError?.(); }} modifiers={[fillMaxWidth(), testID('preparation-variant-name')]}>
        <OutlinedTextField.Label><Text>{t('Variant nomi')}</Text></OutlinedTextField.Label>
      </OutlinedTextField>{initial ? <Text>{t(orderScoped ? 'Bu nom faqat shu buyurtma uchun saqlanadi.' : 'Yangi nom keyingi buyurtmalarga biriktirishda olinadi.')}</Text> : null}
      {error ? <Text>{error}</Text> : null}</Column></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton enabled={!busy} onClick={close}><Text>{t('Bekor qilish')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton enabled={!busy && preparationVariantNameCanSave(value, initial)} onClick={() => submit(value)}
        modifiers={[testID(initial ? 'preparation-variant-rename' : 'preparation-variant-create')]}>
        <Text>{t(busy ? 'Saqlanmoqda…' : 'Saqlash')}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}

// @v2 PreparationFormulaVariantsScreen
export function PreparationFormulaVariantsScreen() {
  const { data } = useLocalSearchParams<{ data?: string }>();
  const options = readPreparationRouteData<Options>(data);
  return options ? <Variants options={options} /> : <PreparationPage title="Formulalar"><PreparationText>Formula topilmadi. Ro‘yxatni yangilang</PreparationText></PreparationPage>;
}

function Variants({ options }: { options: Options }) {
  const { session } = usePreparationContext(), state = usePreparationVariantsView(session, options), dialogs = usePreparationDialogs(), t = usePreparationText();
  const colors = useMaterialColors(), insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const notice = usePreparationNotice();
  const [nameDialog, setNameDialog] = useState<'create' | Variant | null>(null), [renaming, setRenaming] = useState(false), [renameError, setRenameError] = useState<string | null>(null);
  const [hideCreateError, setHideCreateError] = useState(false);
  const [reusePicker, setReusePicker] = useState(false), [opening, setOpening] = useState(false);
  const renameInFlight = useRef(false);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => { if (focused.current) { setOpening(false); void state.controller.load(); } focused.current = true; }, [state.controller]));
  const blocked = state.actionsBlocked || opening;
  const setDockHeight = usePreparationFab('variants', {
    actions: [{ id: 'add', label: t('Variant qo‘shish'), icon: 'add', width: 240 },
      { id: 'reuse', label: t('Qidirib variant qo‘shish'), icon: 'search', width: 290 }],
    enabled: !blocked, visible: true, openLabel: t('Amallarni ochish'), closeLabel: t('Amallarni yopish'),
    onSelect: action => {
      if (blocked) return;
      if (action === 'add') void state.controller.beginCreate().then(id => { if (id) setNameDialog('create'); });
      else if (action === 'reuse' && state.controller.beginReuse()) setReusePicker(true);
    },
  });
  const open = (variant: Variant, edit = false) => {
    setOpening(true);
    openPreparationFormula({ ...options, variantId: variant.id, variantName: variant.name, variantCode: variant.formula_code, openEditorOnLoad: edit });
  };
  const perform = async (variant: Variant, action: VariantAction) => {
    if (action === 'edit') open(variant, true);
    else if (action === 'rename') { setRenameError(null); setNameDialog(variant); }
    else if (await dialogs.confirm('Shnek formulasini olib tashlash', preparationVariantRemoveMessage(variant.name, options.orderCode), 'O‘chirish')) {
      try { if (await state.controller.remove(variant)) notice.show(preparationVariantRemovedMessage(variant.name)); }
      catch (error) { notice.show(preparationFormulaErrorMessage(error)); }
    }
  };
  const submit = async (name: string) => {
    if (nameDialog === 'create') {
      setHideCreateError(false);
      const variant = await state.controller.create(name);
      if (variant) { setNameDialog(null); open(variant); }
    } else if (nameDialog) {
      if (renameInFlight.current) return;
      renameInFlight.current = true; setRenaming(true); setRenameError(null);
      try { const variant = await state.controller.rename(nameDialog, name); if (variant) setNameDialog(null); }
      catch (error) { setRenameError(preparationFormulaErrorMessage(error)); }
      finally { renameInFlight.current = false; setRenaming(false); }
    }
  };
  const chooseReuse = async (id: string) => {
    setReusePicker(false);
    try { const variant = await state.controller.reuse(id); if (variant) open(variant); }
    catch (error) { notice.show(preparationFormulaErrorMessage(error)); }
  };
  return <>
    <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <RoleHeader title={t('Shnek formulalar')} navigation={{ icon: 'back', label: t('Orqaga'), onPress: () => {
      if (router.canGoBack()) router.back(); else router.replace('/android-preparation' as Href);
    } }} />
    <OrdersList active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} passthrough={passthroughListItems}
      onRefresh={async () => { await state.controller.load(); }}>
    <View style={styles.context}>
      <PreparationText>{`${options.materialName} • ${options.orderCode}`}</PreparationText>
      <PreparationText>{`${options.orderCode} • ${options.productTitle}`}</PreparationText>
    </View>
      {state.loading && !state.variants.length ? <ActivityIndicator /> : null}
      {state.error ? <View style={styles.context}><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => void state.controller.load()} /></View> : null}
      {state.nameError && !nameDialog ? <View style={styles.context}><PreparationText>{state.nameError}</PreparationText></View> : null}
      {!state.loading && !state.error && !state.variants.length ? <View style={styles.context}><PreparationText>{t('Hali shnek varianti yo‘q. FAB orqali variant qo‘shing.')}</PreparationText></View> : null}
      {state.variants.map((variant, index) => <VariantRow key={variant.id} title={variant.name} subtitle={preparationVariantSubtitle(variant)}
        first={index === 0} last={index === state.variants.length - 1} disabled={blocked}
        onPress={() => open(variant)} onAction={action => { if (!blocked) void perform(variant, action); }} />)}
      <View style={{ height: 112 }} />
    </OrdersList>
    <View onLayout={event => setDockHeight(event.nativeEvent.layout.height)}><PreparationDock /></View>
    <PreparationNotice message={notice.message} /></View>
    {nameDialog ? <VariantNameDialog initial={nameDialog === 'create' ? undefined : nameDialog.name} busy={state.savingName || renaming}
      error={nameDialog === 'create' ? (hideCreateError ? null : state.nameError) : renameError} submit={name => void submit(name)} orderScoped
      clearError={() => { setRenameError(null); setHideCreateError(true); }}
      cancel={() => { if (nameDialog === 'create') state.controller.cancelCreate(); setNameDialog(null); }} /> : null}
    {reusePicker && state.creating ? <ReusePicker controller={state.controller} choose={id => void chooseReuse(id)} close={() => {
      state.controller.cancelReuse(); setReusePicker(false);
    }} /> : null}
  </>;
}

const styles = StyleSheet.create({
  context: { padding: 16, gap: 8 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, marginStart: 16, paddingVertical: 6 },
  headline: { fontSize: 16, lineHeight: 24, fontWeight: '500', includeFontPadding: false },
  supporting: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
});
