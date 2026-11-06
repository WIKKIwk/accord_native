import { Button, Host, List, Menu, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled, keyboardType } from '@expo/ui/swift-ui/modifiers';
import { Stack, useFocusEffect, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationList, PreparationStatus, preparationAlert, usePreparationText } from './PreparationUI';
import { PreparationSharesDialog } from './PreparationSharesDialog';
import type { FormulaEditorRow } from './preparationLogic';
import { preparationEstimatedKgDisplay, preparationFormulaSharesComplete, preparationScrewLineKg, type PreparationFormula as Formula } from './preparationModel';
import { usePreparationFormula, type PreparationFormulaOptions } from './usePreparationFormula';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { openPreparationScale } from './PreparationRoutes';

type Material = ReturnType<typeof usePreparationFormula>['materials'][number];
function FormulaLine({ row, index, materials, busy, change, remove, canRemove }: { row: FormulaEditorRow; index: number; materials: Material[];
  busy: boolean; change: (row: FormulaEditorRow) => void; remove: () => void; canRemove: boolean }) {
  const nativePercent = useNativeState(row.percent), t = usePreparationText();
  return <Section title={`${index + 1}. ${row.material?.name ?? t('Seriyo tanlang')}`}>
    <Menu label={row.material?.name ?? t('Seriyo tanlang')} modifiers={[disabled(busy)]}>
      {materials.filter(item => item.can_receive).map(item => <Button key={item.code} label={item.name} onPress={() => change({ ...row, material: item })} />)}
    </Menu>
    <TextField text={nativePercent} placeholder={t('Foiz (%)')} modifiers={[keyboardType('decimal-pad'), disabled(busy)]}
      onTextChange={percent => change({ ...row, percent })} />
    <Button label={t('Olib tashlash')} role="destructive" modifiers={[disabled(busy || !canRemove)]} onPress={remove} />
  </Section>;
}
function FormulaDetails({ formula, select }: {
  formula: Formula; select: (action: 'shares' | 'edit' | 'delete') => void;
}) {
  const t = usePreparationText();
  return <Host style={{ minHeight: 300 }}><VStack><Text>{t('Formula ma’lumotlari')}</Text><Text>{formula.name}</Text><List>
    {formula.lines.map(line => <Text key={line.item_code}>{line.name} · {line.percent}%</Text>)}
  </List><Button label={t('Tahrirlash')} onPress={() => select('edit')} />
    <Button label={t('O‘chirish')} role="destructive" onPress={() => select('delete')} />
    <Button label={t('Shnek ulushlarini belgilash')} onPress={() => select('shares')} /></VStack></Host>;
}

// @v2 PreparationOrderFormulaScreen
export function PreparationFormula() {
  const params = useLocalSearchParams<Record<string, string | undefined>>();
  const options = useMemo<PreparationFormulaOptions>(() => ({ orderId: params.orderId ?? '', orderCode: params.orderCode ?? '',
    productCode: params.productCode ?? '', productTitle: params.productTitle ?? '', materialId: params.materialId ?? '', materialName: params.materialName ?? '',
    variantId: params.variantId, variantName: params.variantName, initialFormulaName: params.initialFormulaName,
    manageSavedFormula: params.manageSavedFormula === 'true', allowAddingFormula: params.allowAddingFormula === 'true',
    openEditorOnLoad: params.openEditorOnLoad === 'true' }), [params.orderId, params.orderCode, params.productCode, params.productTitle,
      params.materialId, params.materialName, params.variantId, params.variantName, params.initialFormulaName, params.manageSavedFormula,
      params.allowAddingFormula, params.openEditorOnLoad]);
  const { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const state = usePreparationFormula(session, options), { controller } = state;
  const [sharing, setSharing] = useState(false);
  const scaleReturn = useRef<(() => void) | null>(null);
  useFocusEffect(useCallback(() => { scaleReturn.current?.(); scaleReturn.current = null; }, []));
  useEffect(() => () => { scaleReturn.current?.(); scaleReturn.current = null; }, []);
  const busy = state.loading || state.saving || state.deleting || state.openingReceipt;
  usePreventRemove(state.saving || state.deleting, () => {});
  const updateRow = (index: number, row: FormulaEditorRow) => controller.setRows(state.rows.map((old, i) => i === index ? row : old));
  const lineEstimate = (formula: Formula, percent: string) => {
    if (!state.estimatedMaterialKg || !formula.share_percent || !preparationFormulaSharesComplete(state.formulas)) return '';
    try { return ` · ≈ ${preparationEstimatedKgDisplay(preparationScrewLineKg(state.estimatedMaterialKg, formula.share_percent, percent))} kg`; }
    catch { return ''; }
  };
  const openDetails = (formula: Formula) => {
    let selected: 'shares' | 'edit' | 'delete' | null = null;
    sheet.open(<FormulaDetails formula={formula} select={action => { selected = action; sheet.close(); }} />,
      { compact: true, dismissible: true, onDismiss: () => {
        if (selected === 'shares') setSharing(true);
        else if (selected === 'edit') controller.openEditor(formula);
        else if (selected === 'delete') Alert.alert(t('Formulani o‘chirish'), `«${formula.name}» formulasi o‘chirilsinmi?`, [
          { text: t('Bekor qilish'), style: 'cancel' }, { text: t('O‘chirish'), style: 'destructive', onPress: () => {
            void controller.remove(formula.name).catch(preparationAlert);
          } },
        ]);
      } });
  };
  return <><Stack.Screen options={{ title: options.variantName || t('Formula'), gestureEnabled: !state.saving && !state.deleting }} />
    <PreparationList refresh={() => controller.reload()}>
      <PreparationStatus loading={state.loading || state.saving || state.deleting} error={state.error} retry={() => { void controller.reload(); }} />
      {!!state.notice && <Section><Text>{state.notice}</Text><Button label={t('Yopish')} onPress={() => controller.clearNotice()} /></Section>}
      <Section><Text>{options.productTitle}</Text><Text>{options.materialName}</Text>
        {!options.manageSavedFormula && !state.estimatedMaterialKg && <Text>{t('Taxminiy kg hisobi hozir mavjud emas')}</Text>}
        {state.estimatedMaterialKg && <Text>{t('Taxminiy kg')}: {state.estimatedMaterialKg}</Text>}
      </Section>
      {state.editing ? <>
        {state.rows.map((row, index) => <FormulaLine key={`${state.editingName ?? 'new'}:${index}:${row.material?.code ?? ''}`} row={row} index={index} materials={state.materials}
          busy={busy} canRemove={state.rows.length > 1} change={value => updateRow(index, value)} remove={() => controller.setRows(state.rows.filter((_, i) => i !== index))} />)}
        <Section><Button label={t('Seriyo qo‘shish')} modifiers={[disabled(busy)]} onPress={() => controller.setRows([...state.rows, { material: null, percent: '' }])} />
          {!!state.editorError && <Text>{state.editorError}</Text>}
          <Button label={t('Saqlash')} modifiers={[disabled(!state.canSave || busy)]} onPress={() => { void controller.save().catch(preparationAlert); }} />
          <Button label={t('Bekor qilish')} modifiers={[disabled(busy)]} onPress={() => controller.closeEditor()} /></Section>
      </> : <Section>
        {!options.manageSavedFormula && canOpenRoute(session, appRoutes.gscaleMode) && <Button label={t('Ishlab chiqarishni boshlash')}
          modifiers={[disabled(busy)]} onPress={() => { void controller.startProduction(true, args => new Promise<void>((resolve, reject) => {
            scaleReturn.current = resolve;
            try { openPreparationScale(args); } catch (error) { scaleReturn.current = null; reject(error); }
          })).catch(preparationAlert); }} />}
        {!state.formulas.length && <Text>{t(options.manageSavedFormula && !options.allowAddingFormula ? 'Bu formulada ichki tarkib yo‘q.' : 'Hali formula yo‘q. FAB orqali formula qo‘shing.')}</Text>}
        {state.formulas.length > 0 && <Button label={t('Shnek ulushlari')} modifiers={[disabled(busy)]} onPress={() => setSharing(true)} />}
        {state.formulas.map(formula => <Button key={formula.name} modifiers={[disabled(busy)]} onPress={() => openDetails(formula)}>
          <VStack alignment="leading"><Text>{formula.name}</Text><Text>{formula.lines.map(line => `${line.name} ${line.percent}%${lineEstimate(formula, line.percent)}`).join(' · ')}</Text></VStack>
        </Button>)}
        {(!options.manageSavedFormula || options.allowAddingFormula) && <Button label={t('Formula qo‘shish')} modifiers={[disabled(busy)]} onPress={() => controller.openEditor()} />}
      </Section>}
    </PreparationList>
    {sharing && <PreparationSharesDialog formulas={state.formulas} materialName={options.materialName} close={() => setSharing(false)}
      save={values => controller.saveShares(values)} />}</>;
}
