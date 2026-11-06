import { AlertDialog, Column, Host, OutlinedTextField, Text, TextButton, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View, useWindowDimensions } from 'react-native';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext.android';
import { PreparationNotice } from './PreparationNotice';
import { openPreparationFormula, readPreparationRouteData } from './preparationNavigation.android';
import { PreparationButton, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { preparationVariantNameCanSave } from './usePreparationLibrary';
import { usePreparationVariantsView } from './usePreparationAndroidView.android';
import { preparationFormulaErrorMessage } from './usePreparationFormula';
import { preparationReuseSubtitle, type PreparationVariantsOptions, type PreparationVariantsState } from './usePreparationVariants';
import { usePreparationReusePicker } from './usePreparationReusePicker.android';
import { preparationVariantRemoveMessage, preparationVariantRemovedMessage, preparationVariantSubtitle } from './preparationVariantPresentation';
import { usePreparationNotice } from './usePreparationNotice';

type Options = PreparationVariantsOptions & { orderCode: string; productTitle: string; materialName: string };
type Variant = ReturnType<typeof usePreparationVariantsView>['variants'][number];

function VariantActions({ variant, choose }: { variant: Variant; choose: (action: 'edit' | 'delete' | 'rename') => void }) {
  const t = usePreparationText();
  return <View style={{ padding: 16, gap: 10 }}><PreparationText title>{variant.name}</PreparationText>
    {variant.formula_code ? <PreparationText>{variant.formula_code}</PreparationText> : null}
    <PreparationRow title={t('Tahrirlash')} onPress={() => choose('edit')} />
    <PreparationRow title={t('O‘chirish')} onPress={() => choose('delete')} />
    <PreparationRow title={t('Nomini o‘zgartirish')} onPress={() => choose('rename')} />
  </View>;
}

function ReusePicker({ controller, close, choose }: { controller: PreparationVariantsState; close: () => void; choose: (id: string) => void }) {
  const picker = usePreparationReusePicker(controller), query = useNativeState(''), t = usePreparationText();
  return <WorkerOrderSheet onClose={close} dismissible>
    <View style={{ flex: 1, padding: 16, gap: 10 }}>
      <PreparationText title>{t('Shnek formulasini tanlang')}</PreparationText>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField value={query} singleLine autoFocus
        onValueChange={picker.setQuery} modifiers={[fillMaxWidth(), testID('preparation-variant-reuse-search')]}>
        <OutlinedTextField.Label><Text>{t('Formula nomi, kodi yoki buyurtmani qidirish')}</Text></OutlinedTextField.Label>
      </OutlinedTextField></Host>
      <FlatList data={picker.items} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled"
        onEndReached={picker.loadMore} onEndReachedThreshold={0.4}
        renderItem={({ item }) => <PreparationRow title={item.name} subtitle={preparationReuseSubtitle(item)} onPress={() => choose(item.id)} />}
        contentContainerStyle={{ gap: 8, paddingBottom: 16, flexGrow: 1 }}
        ListEmptyComponent={!picker.loading && !picker.error ? <PreparationText>{t('Formula topilmadi.')}</PreparationText> : undefined}
        ListFooterComponent={<>{picker.loading ? <ActivityIndicator /> : null}
          {picker.error ? <><PreparationText>{picker.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={picker.retry} /></> : null}
          {picker.hasMore && !picker.loading && !picker.error ? <PreparationButton label="Yana yuklash" onPress={picker.loadMore} /> : null}</>} />
      <PreparationButton label="Bekor qilish" onPress={close} />
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
  const sheet = useNativeSheet(), notice = usePreparationNotice(), afterSheet = useRef<(() => void) | null>(null);
  const [nameDialog, setNameDialog] = useState<'create' | Variant | null>(null), [renaming, setRenaming] = useState(false), [renameError, setRenameError] = useState<string | null>(null);
  const [hideCreateError, setHideCreateError] = useState(false);
  const [reusePicker, setReusePicker] = useState(false), [opening, setOpening] = useState(false);
  const renameInFlight = useRef(false);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => { if (focused.current) { setOpening(false); void state.controller.load(); } focused.current = true; }, [state.controller]));
  const blocked = state.actionsBlocked || opening;
  const open = (variant: Variant, edit = false) => {
    setOpening(true);
    openPreparationFormula({ ...options, variantId: variant.id, variantName: variant.name, openEditorOnLoad: edit });
  };
  const perform = async (variant: Variant, action: 'edit' | 'delete' | 'rename') => {
    if (action === 'edit') open(variant, true);
    else if (action === 'rename') { setRenameError(null); setNameDialog(variant); }
    else if (await dialogs.confirm('Shnek formulasini olib tashlash', preparationVariantRemoveMessage(variant.name, options.orderCode), 'O‘chirish')) {
      try { if (await state.controller.remove(variant)) notice.show(preparationVariantRemovedMessage(variant.name)); }
      catch (error) { notice.show(preparationFormulaErrorMessage(error)); }
    }
  };
  const menu = (variant: Variant) => {
    if (blocked) return;
    sheet.open(<VariantActions variant={variant} choose={action => {
      afterSheet.current = () => { void perform(variant, action); }; sheet.close();
    }} />, { compact: true, dismissible: true, onDismiss: () => {
      const next = afterSheet.current; afterSheet.current = null; next?.();
    } });
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
    <View style={{ flex: 1 }}><PreparationPage title="Shnek formulalar" refreshing={state.loading && !!state.variants.length} onRefresh={() => void state.controller.load()}>
      <PreparationText>{`${options.materialName} • ${options.orderCode}`}</PreparationText>
      <PreparationText>{`${options.orderCode} • ${options.productTitle}`}</PreparationText>
      {state.loading && !state.variants.length ? <ActivityIndicator /> : null}
      {state.error ? <><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => void state.controller.load()} /></> : null}
      {state.nameError && !nameDialog ? <PreparationText>{state.nameError}</PreparationText> : null}
      {!state.loading && !state.error && !state.variants.length ? <PreparationText>{t('Hali shnek varianti yo‘q. FAB orqali variant qo‘shing.')}</PreparationText> : null}
      {state.variants.map(variant => <PreparationRow key={variant.id} title={variant.name}
        subtitle={preparationVariantSubtitle(variant)}
        disabled={blocked} onPress={() => open(variant)} onLongPress={() => menu(variant)} />)}
      <PreparationButton label="Variant qo‘shish" disabled={blocked} id="preparation-variant-add" onPress={() => {
        void state.controller.beginCreate().then(id => { if (id) setNameDialog('create'); });
      }} />
      <PreparationButton label="Qidirib variant qo‘shish" disabled={blocked} id="preparation-variant-reuse" onPress={() => {
        if (state.controller.beginReuse()) setReusePicker(true);
      }} />
    </PreparationPage><PreparationNotice message={notice.message} /></View>
    {nameDialog ? <VariantNameDialog initial={nameDialog === 'create' ? undefined : nameDialog.name} busy={state.savingName || renaming}
      error={nameDialog === 'create' ? (hideCreateError ? null : state.nameError) : renameError} submit={name => void submit(name)} orderScoped
      clearError={() => { setRenameError(null); setHideCreateError(true); }}
      cancel={() => { if (nameDialog === 'create') state.controller.cancelCreate(); setNameDialog(null); }} /> : null}
    {reusePicker && state.creating ? <ReusePicker controller={state.controller} choose={id => void chooseReuse(id)} close={() => {
      state.controller.cancelReuse(); setReusePicker(false);
    }} /> : null}
  </>;
}
