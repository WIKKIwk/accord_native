import { AlertDialog, Host, OutlinedTextField, Text, TextButton, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, useWindowDimensions } from 'react-native';
import { usePreparationContext } from './PreparationContext.android';
import { openPreparationFormula, readPreparationRouteData } from './preparationNavigation.android';
import { PreparationButton, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { preparationVariantNameCanSave } from './usePreparationLibrary';
import { usePreparationVariants, type PreparationVariantsOptions } from './usePreparationVariants';

type Options = PreparationVariantsOptions & { orderCode: string; productTitle: string; materialName: string };
type Variant = ReturnType<typeof usePreparationVariants>['variants'][number];

// @v2 _VariantNameDialog
function VariantNameDialog({ initial, busy, error, submit, cancel }: { initial?: string; busy: boolean; error: string | null;
  submit: (name: string) => void; cancel: () => void }) {
  const { width, height } = useWindowDimensions(), t = usePreparationText();
  const nativeValue = useNativeState(initial ?? ''), [value, setValue] = useState(initial ?? '');
  const close = () => { if (!busy) cancel(); };
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={close} properties={{ dismissOnBackPress: !busy, dismissOnClickOutside: !busy }}>
      <AlertDialog.Title><Text>{t(initial ? 'Nomini o‘zgartirish' : 'Variant qo‘shish')}</Text></AlertDialog.Title>
      <AlertDialog.Text><OutlinedTextField value={nativeValue} enabled={!busy} singleLine onValueChange={setValue} modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Label><Text>{t('Variant nomi')}</Text></OutlinedTextField.Label>
      </OutlinedTextField>{error ? <Text>{error}</Text> : null}</AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton enabled={!busy} onClick={close}><Text>{t('Bekor qilish')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton enabled={!busy && preparationVariantNameCanSave(value, initial)} onClick={() => submit(value)}>
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
  const { session } = usePreparationContext(), state = usePreparationVariants(session, options), dialogs = usePreparationDialogs(), t = usePreparationText();
  const [nameDialog, setNameDialog] = useState<'create' | Variant | null>(null), [renaming, setRenaming] = useState(false), [renameError, setRenameError] = useState<string | null>(null);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => { if (focused.current) void state.controller.load(); focused.current = true; }, [state.controller]));
  const blocked = state.loading || state.creating || state.opening || state.removing || state.copying;
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
      const variant = await state.controller.create(name);
      if (variant) { setNameDialog(null); open(variant); }
    } else if (nameDialog) {
      setRenaming(true); setRenameError(null);
      try { const variant = await state.controller.rename(nameDialog, name); if (variant) setNameDialog(null); }
      catch (error) { setRenameError(error instanceof Error ? error.message : String(error)); }
      finally { setRenaming(false); }
    }
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
    </PreparationPage>
    {nameDialog ? <VariantNameDialog initial={nameDialog === 'create' ? undefined : nameDialog.name} busy={state.savingName || renaming}
      error={nameDialog === 'create' ? state.nameError : renameError} submit={name => void submit(name)}
      cancel={() => { if (nameDialog === 'create') state.controller.cancelCreate(); setNameDialog(null); }} /> : null}
  </>;
}
