import { AlertDialog, Host, RNHostView, Text, TextButton } from '@expo/ui/jetpack-compose';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native';
import { usePreparationContext } from './PreparationContext.android';
import { preparationEstimatedKgDisplay, preparationDisplay, type PreparationFormula } from './preparationModel';
import { preparationFormulaPresentation, preparationShareDisplay, readPreparationRouteData } from './preparationNavigation.android';
import { PreparationButton, PreparationField, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { usePreparationFormula, type PreparationFormulaOptions } from './usePreparationFormula';

// @v2 _FormulaSharesSheet
export function PreparationSharesDialog({ formulas, onSave, onClose }: {
  formulas: PreparationFormula[]; onSave: (values: string[]) => Promise<void>; onClose: () => void;
}) {
  const [values, setValues] = useState(() => formulas.map(formula => formula.share_percent ? preparationDisplay(formula.share_percent) : ''));
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  const { width, height } = useWindowDimensions(), t = usePreparationText(), status = preparationShareDisplay(values);
  const close = () => { if (!saving) onClose(); };
  const save = async () => {
    if (!status.valid || saving) return;
    setSaving(true); setError(null);
    try { await onSave(values); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t('Shnek ulushlari saqlanmadi. Qayta urinib ko‘ring')); }
    finally { setSaving(false); }
  };
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={close} properties={{ dismissOnBackPress: !saving, dismissOnClickOutside: !saving }}>
      <AlertDialog.Title><Text>{t('Shnek ulushlari')}</Text></AlertDialog.Title>
      <AlertDialog.Text><RNHostView matchContents><ScrollView style={{ maxHeight: height * 0.55, width: width * 0.7 }} contentContainerStyle={{ gap: 8 }}>
        {formulas.map((formula, index) => <PreparationField key={`${index}:${formula.name}`} label={`${formula.name} shnek ulushi`}
          initial={values[index]} decimal enabled={!saving} onChange={value => { setError(null); setValues(old => old.map((entry, i) => i === index ? value : entry)); }} />)}
        <PreparationText>{status.total === null ? t('Har bir shnek uchun 0 dan katta, 100 gacha foiz kiriting') : `${t('Jami')}: ${status.total}% / 100%`}</PreparationText>
        {error ? <PreparationText>{error}</PreparationText> : null}
      </ScrollView></RNHostView></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton enabled={!saving} onClick={close}><Text>{t('Bekor qilish')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton enabled={status.valid && !saving} onClick={() => void save()}><Text>{t('Saqlash')}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}

// @v2 PreparationOrderFormulaScreen
export function PreparationOrderFormulaScreen() {
  const { data } = useLocalSearchParams<{ data?: string }>();
  const options = readPreparationRouteData<PreparationFormulaOptions>(data);
  return options ? <FormulaEditor options={options} /> : <PreparationPage title="Formulalar"><PreparationText>Formula topilmadi. Ro‘yxatni yangilang</PreparationText></PreparationPage>;
}

function FormulaEditor({ options }: { options: PreparationFormulaOptions }) {
  const { session } = usePreparationContext(), state = usePreparationFormula(session, options), dialogs = usePreparationDialogs(), t = usePreparationText();
  const [shares, setShares] = useState(false);
  const blocked = state.loading || state.saving || state.deleting || state.openingReceipt;
  const showError = (error: unknown) => dialogs.message('Xatolik yuz berdi', error instanceof Error ? error.message : String(error));
  const openFormula = async (formula: PreparationFormula) => {
    const action = await dialogs.choose(formula.name, [
      { label: 'Shnek ulushlarini belgilash', value: 'shares' }, { label: 'Tahrirlash', value: 'edit' }, { label: 'O‘chirish', value: 'delete' },
    ], `${options.materialName} · ${formula.name}\n${preparationFormulaPresentation(formula, state.formulas, state.estimatedMaterialKg)}`);
    if (action === 'shares') setShares(true);
    else if (action === 'edit') state.controller.openEditor(formula);
    else if (action === 'delete' && await dialogs.confirm('Formulani o‘chirish', `«${formula.name}» formulasi o‘chirilsinmi?`, 'O‘chirish')) {
      try { await state.controller.remove(formula.name); } catch (error) { showError(error); }
    }
  };
  const chooseMaterial = async (index: number) => {
    const code = await dialogs.choose('Homashyo tanlang', state.materials.map(item => ({ label: item.name, subtitle: item.code, value: item.code })));
    const material = state.materials.find(item => item.code === code);
    if (material) state.controller.setRows(state.rows.map((row, i) => i === index ? { ...row, material } : row));
  };
  return <>
    <PreparationPage title={state.variantName || 'Formulalar'} refreshing={state.loading} onRefresh={() => void state.controller.reload()}>
      {state.loading && !state.materials.length ? <ActivityIndicator /> : null}
      {state.error ? <PreparationRow title={t('Xatolik yuz berdi')} subtitle={state.error} /> : null}
      {state.notice ? <PreparationRow title={t('Xatolik yuz berdi')} subtitle={state.notice} /> : null}
      <PreparationRow title={options.productTitle || options.productCode} subtitle={[options.orderCode, options.materialName].filter(Boolean).join(' · ')} />
      {!options.manageSavedFormula ? <PreparationText>{state.estimatedMaterialKg === null ? t('Taxminiy kg hisobi hozir mavjud emas') :
        `${options.materialName}: ≈ ${preparationEstimatedKgDisplay(state.estimatedMaterialKg)} kg`}</PreparationText> : null}
      {state.editing ? <>
        <PreparationText title>{state.editingName ?? t('Yangi formula')}</PreparationText>
        {state.rows.map((row, index) => <PreparationRowEditor key={`${index}:${row.material?.code ?? ''}`} index={index} row={row} disabled={state.saving}
          choose={() => void chooseMaterial(index)} update={percent => state.controller.setRows(state.rows.map((entry, i) => i === index ? { ...entry, percent } : entry))}
          remove={() => state.controller.setRows(state.rows.filter((_, i) => i !== index))} />)}
        <PreparationButton label="Homashyo qo‘shish" disabled={state.saving} onPress={() => state.controller.setRows([...state.rows, { material: null, percent: '' }])} />
        {state.editorError ? <PreparationText>{state.editorError}</PreparationText> : null}
        <PreparationButton label="Saqlash" id="preparation-formula-save" disabled={!state.canSave}
          onPress={() => { void state.controller.save().catch(showError); }} />
        <PreparationButton label="Bekor qilish" disabled={state.saving} onPress={() => state.controller.closeEditor()} />
      </> : null}
      {state.formulas.map(formula => <PreparationRow key={formula.name} title={formula.name}
        subtitle={preparationFormulaPresentation(formula, state.formulas, state.estimatedMaterialKg)} disabled={blocked}
        onPress={() => void openFormula(formula)} />)}
      {(!options.manageSavedFormula || options.allowAddingFormula) && !state.editing ? <PreparationButton
        label={options.manageSavedFormula ? 'Ichki formula qo‘shish' : 'Shnek formula qo‘shish'} disabled={blocked}
        onPress={() => state.controller.openEditor()} /> : null}
    </PreparationPage>
    {shares ? <PreparationSharesDialog formulas={state.formulas} onSave={values => state.controller.saveShares(values)} onClose={() => setShares(false)} /> : null}
  </>;
}

function PreparationRowEditor({ row, index, disabled, choose, update, remove }: {
  row: { material: { code: string; name: string } | null; percent: string }; index: number; disabled: boolean;
  choose: () => void; update: (value: string) => void; remove: () => void;
}) {
  const t = usePreparationText();
  return <>
    <PreparationRow title={row.material?.name ?? t('Homashyo tanlang')} subtitle={row.material?.code} disabled={disabled} onPress={choose} />
    <PreparationField label={`${index + 1} — %`} initial={row.percent} enabled={!disabled} decimal onChange={update} />
    <PreparationButton label="O‘chirish" disabled={disabled} onPress={remove} />
  </>;
}
