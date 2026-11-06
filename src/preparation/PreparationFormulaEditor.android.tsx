import { Host, ModalBottomSheet, RNHostView } from '@expo/ui/jetpack-compose';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeSheet } from '../nativeSheet';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { usePreparationContext } from './PreparationContext.android';
import { PreparationFormulaDetails, type FormulaDetailAction } from './PreparationFormulaDetails.android';
import { preparationEstimatedKgDisplay, preparationDisplay, type PreparationFormula } from './preparationModel';
import { openPreparationScale, preparationFormulaPresentation, preparationShareDisplay, readPreparationRouteData } from './preparationNavigation.android';
import { PreparationButton, PreparationField, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { usePreparationFormulaView } from './usePreparationAndroidView.android';
import type { PreparationFormulaOptions } from './usePreparationFormula';
import { preparationShareErrorMessage, preparationShareIntroduction } from './preparationSharePresentation';

// @v2 _FormulaSharesSheet
export function PreparationSharesDialog({ formulas, materialName, onSave, onClose }: {
  formulas: PreparationFormula[]; materialName: string; onSave: (values: string[]) => Promise<void>; onClose: () => void;
}) {
  const [values, setValues] = useState(() => formulas.map(formula => formula.share_percent ? preparationDisplay(formula.share_percent) : ''));
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets(), t = usePreparationText(), status = preparationShareDisplay(values);
  useEffect(() => {
    if (!saving) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => listener.remove();
  }, [saving]);
  const close = () => { if (!savingRef.current) onClose(); };
  const save = async () => {
    if (!status.valid || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(null);
    try { await onSave(values); onClose(); }
    catch (failure) { setError(preparationShareErrorMessage(failure)); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <ModalBottomSheet onDismissRequest={close} skipPartiallyExpanded sheetGesturesEnabled={!saving} showDragHandle
      properties={{ shouldDismissOnBackPress: !saving, shouldDismissOnClickOutside: !saving }}>
      <RNHostView matchContents><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.8, width }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20, gap: 12 }}>
        <PreparationText title>{t('Shnek ulushlari')}</PreparationText>
        <PreparationText>{preparationShareIntroduction(materialName)}</PreparationText>
        {formulas.map((formula, index) => <PreparationField key={`${index}:${formula.name}`} label={`${formula.name} shnek ulushi`}
          initial={values[index]} decimal suffix="%" enabled={!saving} onChange={value => { setError(null); setValues(old => old.map((entry, i) => i === index ? value : entry)); }} />)}
        <PreparationText>{status.total === null ? t('Har bir shnek uchun 0 dan katta, 100 gacha foiz kiriting') : `${t('Jami')}: ${status.total}% / 100%`}</PreparationText>
        {error ? <PreparationText>{error}</PreparationText> : null}
        <PreparationButton label={saving ? 'Saqlanmoqda…' : 'Saqlash'} id="preparation-screw-shares-save" disabled={!status.valid || saving} onPress={() => void save()} />
      </ScrollView></RNHostView>
    </ModalBottomSheet>
  </Host>;
}

// @v2 PreparationOrderFormulaScreen
export function PreparationOrderFormulaScreen() {
  const { data } = useLocalSearchParams<{ data?: string }>();
  const options = readPreparationRouteData<PreparationFormulaOptions>(data);
  return options ? <FormulaEditor options={options} /> : <PreparationPage title="Formulalar"><PreparationText>Formula topilmadi. Ro‘yxatni yangilang</PreparationText></PreparationPage>;
}

function FormulaEditor({ options }: { options: PreparationFormulaOptions }) {
  const { session } = usePreparationContext(), state = usePreparationFormulaView(session, options), dialogs = usePreparationDialogs(), t = usePreparationText();
  const [shares, setShares] = useState(false), sheet = useNativeSheet();
  const scaleReturn = useRef<(() => void) | null>(null);
  useFocusEffect(useCallback(() => { scaleReturn.current?.(); scaleReturn.current = null; }, []));
  useEffect(() => () => { scaleReturn.current?.(); scaleReturn.current = null; }, []);
  const blocked = state.actionsBlocked;
  const canOpenScale = canOpenRoute(session, appRoutes.gscaleMode);
  const showError = (error: unknown) => dialogs.message('Xatolik yuz berdi', error instanceof Error ? error.message : String(error));
  const formulaAction = async (formula: PreparationFormula, action: FormulaDetailAction) => {
    if (action === 'shares') setShares(true);
    else if (action === 'edit') state.controller.openEditor(formula);
    else if (action === 'delete' && await dialogs.confirm('Formulani o‘chirish', `«${formula.name}» formulasi o‘chirilsinmi?`, 'O‘chirish')) {
      try { await state.controller.remove(formula.name); } catch (error) { showError(error); }
    }
  };
  const openFormula = (formula: PreparationFormula) => {
    let selected: FormulaDetailAction | null = null;
    sheet.open(<PreparationFormulaDetails formula={formula} formulas={state.formulas} materialName={options.materialName}
      estimatedKg={state.estimatedMaterialKg} onSelect={action => { selected = action; sheet.close(); }} />,
    { dismissible: true, compact: true, onDismiss: () => { if (selected) void formulaAction(formula, selected); } });
  };
  const chooseMaterial = async (index: number) => {
    const code = await dialogs.choose('Homashyo tanlang', state.materials.map(item => ({ label: item.name, subtitle: item.code, value: item.code })), undefined, true);
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
        onPress={() => openFormula(formula)} />)}
      {(!options.manageSavedFormula || options.allowAddingFormula) && !state.editing ? <PreparationButton
        label={options.manageSavedFormula ? 'Ichki formula qo‘shish' : 'Shnek formula qo‘shish'} disabled={blocked}
        onPress={() => state.controller.openEditor()} /> : null}
      {!options.manageSavedFormula && canOpenScale ? <PreparationButton label="Ishlab chiqarishni boshlash" disabled={blocked}
        onPress={() => { void state.controller.startProduction(canOpenScale, args => new Promise<void>((resolve, reject) => {
          scaleReturn.current = resolve;
          try { openPreparationScale(args); } catch (error) { scaleReturn.current = null; reject(error); }
        })).catch(showError); }} /> : null}
    </PreparationPage>
    {shares ? <PreparationSharesDialog formulas={state.formulas} materialName={options.materialName}
      onSave={values => state.controller.saveShares(values)} onClose={() => setShares(false)} /> : null}
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
