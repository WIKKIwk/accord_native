import { AlertDialog, Column, Host, OutlinedTextField, Text, TextButton, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View, useWindowDimensions } from 'react-native';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
import { usePreparationContext } from './PreparationContext.android';
import { openPreparationFormula, readPreparationRouteData } from './preparationNavigation.android';
import { PreparationButton, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { preparationVariantNameCanSave } from './usePreparationLibrary';
import { usePreparationVariantsView } from './usePreparationAndroidView.android';
import { preparationFormulaErrorMessage } from './usePreparationFormula';
import { preparationReuseSubtitle, type PreparationVariantsOptions, type PreparationVariantsState } from './usePreparationVariants';
import { usePreparationReusePicker } from './usePreparationReusePicker.android';

type Options = PreparationVariantsOptions & { orderCode: string; productTitle: string; materialName: string };
type Variant = ReturnType<typeof usePreparationVariantsView>['variants'][number];

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
      <AlertDialog.Text><Column verticalArrangement={{ spacedBy: 8 }}><OutlinedTextField value={nativeValue} enabled={!busy} singleLine autoFocus
        onValueChange={next => { setValue(next); clearError?.(); }} modifiers={[fillMaxWidth(), testID('preparation-variant-name')]}>
        <OutlinedTextField.Label><Text>{t('Variant nomi')}</Text></OutlinedTextField.Label>
      </OutlinedTextField>{initial ? <Text>{t(orderScoped ? 'Bu nom faqat shu buyurtma uchun saqlanadi.' : 'Yangi nom keyingi buyurtmalarga biriktirishda olinadi.')}</Text> : null}
      {error ? <Text>{error}</Text> : null}</Column></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton enabled={!busy} onClick={close}><Text>{t('Bekor qilish')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton enabled={!busy && preparationVariantNameCanSave(value, initial)} onClick={() => submit(value)}
        modifiers={[testID(initial ? 'preparation-variant-rename' : 'preparation-variant-create')]}>
        <Text>{t('Saqlash')}</Text></TextButton></AlertDialog.ConfirmButton>
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
  const [nameDialog, setNameDialog] = useState<'create' | Variant | null>(null), [renaming, setRenaming] = useState(false), [renameError, setRenameError] = useState<string | null>(null);
  const [hideCreateError, setHideCreateError] = useState(false);
  const [reusePicker, setReusePicker] = useState(false);
  const renameInFlight = useRef(false);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => { if (focused.current) void state.controller.load(); focused.current = true; }, [state.controller]));
  const blocked = state.actionsBlocked;
  const open = (variant: Variant) => openPreparationFormula({ ...options, variantId: variant.id, variantName: variant.name });
  const menu = async (variant: Variant) => {
    const action = await dialogs.choose(variant.name, [{ label: 'Tahrirlash', value: 'edit' }, { label: 'O‘chirish', value: 'delete' },
      { label: 'Nomini o‘zgartirish', value: 'rename' }]);
    if (action === 'edit') open(variant);
    else if (action === 'rename') { setRenameError(null); setNameDialog(variant); }
    else if (action === 'delete' && await dialogs.confirm('Variantni o‘chirish', `«${variant.name}» bu buyurtmadan olib tashlansinmi?`, 'O‘chirish')) {
      try { await state.controller.remove(variant); } catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
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
    catch (error) { dialogs.message('Xatolik yuz berdi', preparationFormulaErrorMessage(error)); }
  };
  return <>
    <PreparationPage title={options.materialName || 'Formulalar'} refreshing={state.loading && !!state.variants.length} onRefresh={() => void state.controller.load()}>
      {state.loading && !state.variants.length ? <ActivityIndicator /> : null}
      {state.error ? <><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => void state.controller.load()} /></> : null}
      {state.nameError && !nameDialog ? <PreparationText>{state.nameError}</PreparationText> : null}
      {!state.loading && !state.variants.length ? <PreparationText>{t('Hali shnek varianti yo‘q. FAB orqali variant qo‘shing.')}</PreparationText> : null}
      {state.variants.map(variant => <PreparationRow key={variant.id} title={variant.name}
        subtitle={`${variant.formula_code} · ${variant.formula_count ? `${variant.formula_count} ta` : t('Tarkib hali kiritilmagan')} · ${variant.shares_complete ? '100%' : '—'}`}
        disabled={blocked} onPress={() => open(variant)} onLongPress={() => void menu(variant)} />)}
      <PreparationButton label="Variant qo‘shish" disabled={blocked} id="preparation-variant-add" onPress={() => {
        void state.controller.beginCreate().then(id => { if (id) setNameDialog('create'); });
      }} />
      <PreparationButton label="Qidirib variant qo‘shish" disabled={blocked} id="preparation-variant-reuse" onPress={() => {
        if (state.controller.beginReuse()) setReusePicker(true);
      }} />
    </PreparationPage>
    {nameDialog ? <VariantNameDialog initial={nameDialog === 'create' ? undefined : nameDialog.name} busy={state.savingName || renaming}
      error={nameDialog === 'create' ? (hideCreateError ? null : state.nameError) : renameError} submit={name => void submit(name)} orderScoped
      clearError={() => { setRenameError(null); setHideCreateError(true); }}
      cancel={() => { if (nameDialog === 'create') state.controller.cancelCreate(); setNameDialog(null); }} /> : null}
    {reusePicker && state.creating ? <ReusePicker controller={state.controller} choose={id => void chooseReuse(id)} close={() => {
      state.controller.cancelReuse(); setReusePicker(false);
    }} /> : null}
  </>;
}
