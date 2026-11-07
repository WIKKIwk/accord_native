import { Host, ModalBottomSheet, RNHostView } from '@expo/ui/jetpack-compose';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeSheet } from '../nativeSheet';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { usePreparationContext } from './PreparationContext.android';
import { PreparationFormulaEditForm } from './PreparationFormulaEditForm.android';
import { PreparationFormulaMenu } from './PreparationFormulaMenu.android';
import { PreparationFormulaDetails, type FormulaDetailAction } from './PreparationFormulaDetails.android';
import { InventorySheetButton } from './PreparationInventoryDetails.android';
import { PreparationSeriyoPicker } from './PreparationSeriyoPicker.android';
import type { PreparationMaterial } from './preparationLogic';
import { preparationDisplay, preparationFormulaSharesComplete, type PreparationFormula } from './preparationModel';
import { openPreparationScale, preparationShareDisplay, readPreparationRouteData } from './preparationNavigation.android';
import { preparationNextFormulaName } from './preparationLogic';
import { preparationFormulaCard, preparationFormulaHeading } from './preparationFormulaPresentation';
import { PreparationNotice } from './PreparationNotice';
import { PreparationButton, PreparationField, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { usePreparationFormulaView } from './usePreparationAndroidView.android';
import { preparationFormulaErrorMessage, type PreparationFormulaOptions } from './usePreparationFormula';
import { preparationShareErrorMessage, preparationShareIntroduction, preparationShareSummary } from './preparationSharePresentation';
import { usePreparationNotice } from './usePreparationNotice';

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
  const { message: noticeMessage, show: showNotice } = usePreparationNotice();
  const scaleReturn = useRef<(() => void) | null>(null);
  useFocusEffect(useCallback(() => { scaleReturn.current?.(); scaleReturn.current = null; }, []));
  useEffect(() => () => { scaleReturn.current?.(); scaleReturn.current = null; }, []);
  useEffect(() => { if (state.notice) { showNotice(state.notice); state.controller.clearNotice(); } }, [showNotice, state.controller, state.notice]);
  const blocked = state.actionsBlocked;
  const canOpenScale = canOpenRoute(session, appRoutes.gscaleMode);
  const heading = preparationFormulaHeading(options, state.estimatedMaterialKg), total = preparationShareSummary(state.rows.map(row => row.percent));
  const showError = (error: unknown) => showNotice(preparationFormulaErrorMessage(error));
  const formulaAction = async (formula: PreparationFormula, action: FormulaDetailAction) => {
    if (action === 'shares') setShares(true);
    else if (action === 'edit') state.controller.openEditor(formula);
    else if (action === 'delete' && await dialogs.confirm('Formulani o‘chirish', `«${formula.name}» formulasi o‘chirilsinmi?`, 'O‘chirish')) {
      try { if (await state.controller.remove(formula.name)) showNotice(t('Formula o‘chirildi')); } catch (error) { showError(error); }
    }
  };
  const openFormula = (formula: PreparationFormula) => {
    let selected: FormulaDetailAction | null = null;
    sheet.open(<PreparationFormulaDetails formula={formula} formulas={state.formulas} materialName={options.materialName}
      estimatedKg={state.estimatedMaterialKg} onSelect={action => { selected = action; sheet.close(); }} />,
    { dismissible: true, compact: true, onDismiss: () => { if (selected) void formulaAction(formula, selected); } });
  };
  const chooseMaterial = (index: number) => {
    let selected: PreparationMaterial | null = null;
    sheet.open(<PreparationSeriyoPicker materials={state.materials} choose={material => { selected = material; sheet.close(); }} />,
      { dismissible: true, onDismiss: () => {
        if (!selected) return;
        const rows = state.controller.getSnapshot().rows;
        if (index < rows.length) state.controller.setRows(rows.map((row, i) => i === index ? { ...row, material: selected } : row));
      } });
  };
  return <>
    <View style={{ flex: 1 }}><PreparationPage title={state.variantName || 'Formulalar'} refreshing={state.loading} onRefresh={() => void state.controller.reload()}>
      {state.loading && !state.materials.length ? <ActivityIndicator /> : null}
      {state.error ? <PreparationText>{state.error}</PreparationText> : null}
      {!state.editing ? <>
      {heading.context ? <PreparationText>{heading.context}</PreparationText> : null}
      <PreparationRow title={heading.code} subtitle={heading.subtitle} />
      {heading.estimate !== null ? <PreparationText>{heading.estimate}</PreparationText> : null}
      </> : null}
      {state.editing ? <PreparationFormulaEditForm name={state.editingName ?? preparationNextFormulaName(state.formulas.map(formula => formula.name))}
        creating={state.editingName === null} context={[heading.context, heading.subtitle, heading.estimate].filter(Boolean).join('\n')}
        rows={state.rows} total={total.total} error={state.editorError} saving={state.saving} canSave={state.canSave}
        choose={chooseMaterial} update={(index, percent) => state.controller.setRows(state.rows.map((entry, i) => i === index ? { ...entry, percent } : entry))}
        add={() => state.controller.setRows([...state.rows, { material: null, percent: '' }])}
        remove={index => state.controller.setRows(state.rows.filter((_, i) => i !== index))}
        save={() => { void state.controller.save().then(saved => { if (saved) showNotice(t('Formula saqlandi')); }).catch(showError); }}
        cancel={() => state.controller.closeEditor()} /> : <>
      {state.formulas.length ? <PreparationRow title={t('Shnek ulushlari')} disabled={blocked} subtitle={t(preparationFormulaSharesComplete(state.formulas)
        ? 'Jami: 100% • bitta umumiy tarkib' : 'Jami 100% qilib belgilang — kg shundan keyin hisoblanadi')} onPress={() => setShares(true)} /> : null}
      <PreparationText title>{`${options.variantName ? 'Ichki formulalar' : 'Saqlangan formulalar'} (${state.formulas.length})`}</PreparationText>
      {!state.formulas.length ? <PreparationText>{t(options.manageSavedFormula && !options.allowAddingFormula
        ? 'Bu formulada ichki tarkib yo‘q.' : 'Hali formula yo‘q. FAB orqali formula qo‘shing.')}</PreparationText> : null}
      {state.formulas.map(formula => {
        const card = preparationFormulaCard(formula, state.formulas, state.estimatedMaterialKg);
        return <PreparationRow key={formula.name} title={formula.name}
          subtitle={[card.count, card.share, ...card.lines].join('\n')} disabled={blocked} onPress={() => openFormula(formula)}
          trailing={<PreparationFormulaMenu name={formula.name} disabled={blocked} onSelect={action => {
            if (!blocked && action !== 'rename') void formulaAction(formula, action);
          }} />} />;
      })}
      {(!options.manageSavedFormula || options.allowAddingFormula) ? <InventorySheetButton large
        label={options.manageSavedFormula ? 'Ichki formula qo‘shish' : 'Shnek formula qo‘shish'} disabled={blocked}
        onPress={() => state.controller.openEditor()} /> : null}
      {!options.manageSavedFormula && canOpenScale ? <InventorySheetButton large label="Ishlab chiqarishni boshlash" disabled={blocked}
        onPress={() => { void state.controller.startProduction(canOpenScale, args => new Promise<void>((resolve, reject) => {
          scaleReturn.current = resolve;
          try { openPreparationScale(args); } catch (error) { scaleReturn.current = null; reject(error); }
        })).catch(showError); }} /> : null}
      </>}
    </PreparationPage><PreparationNotice message={noticeMessage} /></View>
    {shares ? <PreparationSharesDialog formulas={state.formulas} materialName={options.materialName}
      onSave={values => state.controller.saveShares(values)} onClose={() => setShares(false)} /> : null}
  </>;
}
