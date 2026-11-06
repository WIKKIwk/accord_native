import { Button, Host, HStack, List, Menu, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled, keyboardType } from '@expo/ui/swift-ui/modifiers';
import { Stack, useFocusEffect, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationList, PreparationStatus, usePreparationText } from './PreparationUI';
import { PreparationNotice } from './PreparationNotice';
import { PreparationSharesDialog } from './PreparationSharesDialog';
import { preparationNextFormulaName, type FormulaEditorRow } from './preparationLogic';
import { preparationFormulaSharesComplete, type PreparationFormula as Formula } from './preparationModel';
import { preparationFormulaCard, preparationFormulaHeading } from './preparationFormulaPresentation';
import { preparationShareSummary } from './preparationSharePresentation';
import { preparationFormulaErrorMessage, usePreparationFormula, type PreparationFormulaOptions } from './usePreparationFormula';
import { usePreparationNotice } from './usePreparationNotice';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { openPreparationScale } from './PreparationRoutes';

type Material = ReturnType<typeof usePreparationFormula>['materials'][number];
function FormulaLine({ row, index, materials, busy, change, remove, canRemove }: { row: FormulaEditorRow; index: number; materials: Material[];
  busy: boolean; change: (row: FormulaEditorRow) => void; remove: () => void; canRemove: boolean }) {
  const nativePercent = useNativeState(row.percent), t = usePreparationText();
  return <Section title={`${index + 1}-seriyo`}>
    {canRemove && <Button label={t('Olib tashlash')} role="destructive" modifiers={[disabled(busy)]} onPress={remove} />}
    <Menu label={row.material?.name ?? t('Seriyo tanlang')} modifiers={[disabled(busy)]}>
      {materials.filter(item => item.can_receive).map(item => <Button key={item.code} label={item.name} onPress={() => change({ ...row, material: item })} />)}
    </Menu>
    {row.material && <TextField text={nativePercent} placeholder={t('Foiz (%)')} modifiers={[keyboardType('decimal-pad'), disabled(busy)]}
      onTextChange={percent => change({ ...row, percent })} />}
  </Section>;
}
function FormulaDetails({ formula, formulas, materialName, estimatedKg, select }: {
  formula: Formula; formulas: Formula[]; materialName: string; estimatedKg: string | null; select: (action: 'shares' | 'edit' | 'delete') => void;
}) {
  const t = usePreparationText(), card = preparationFormulaCard(formula, formulas, estimatedKg);
  return <Host style={{ minHeight: 300 }}><VStack><Text>{t('Formula ma’lumotlari')}</Text>
    <Text>{materialName ? `${materialName} • ${formula.name}` : formula.name}</Text><Text>{card.count}</Text><Text>{card.share}</Text><List>
    {card.lines.map((line, index) => <Text key={index}>{line}</Text>)}
  </List><Button label={t('Tahrirlash')} onPress={() => select('edit')} />
    <Button label={t('O‘chirish')} role="destructive" onPress={() => select('delete')} />
    <Button label={t('Shnek ulushlarini belgilash')} onPress={() => select('shares')} /></VStack></Host>;
}

// @v2 PreparationOrderFormulaScreen
export function PreparationFormula() {
  const params = useLocalSearchParams<Record<string, string | undefined>>();
  const options = useMemo<PreparationFormulaOptions>(() => ({ orderId: params.orderId ?? '', orderCode: params.orderCode ?? '',
    productCode: params.productCode ?? '', productTitle: params.productTitle ?? '', materialId: params.materialId ?? '', materialName: params.materialName ?? '',
    variantId: params.variantId, variantName: params.variantName, variantCode: params.variantCode, customerName: params.customerName, initialFormulaName: params.initialFormulaName,
    manageSavedFormula: params.manageSavedFormula === 'true', allowAddingFormula: params.allowAddingFormula === 'true',
    openEditorOnLoad: params.openEditorOnLoad === 'true' }), [params.orderId, params.orderCode, params.productCode, params.productTitle,
      params.materialId, params.materialName, params.variantId, params.variantName, params.variantCode, params.customerName, params.initialFormulaName, params.manageSavedFormula,
      params.allowAddingFormula, params.openEditorOnLoad]);
  const { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const { message: noticeMessage, show: showNotice } = usePreparationNotice();
  const state = usePreparationFormula(session, options), { controller } = state;
  const [sharing, setSharing] = useState(false);
  const scaleReturn = useRef<(() => void) | null>(null);
  useFocusEffect(useCallback(() => { scaleReturn.current?.(); scaleReturn.current = null; }, []));
  useEffect(() => () => { scaleReturn.current?.(); scaleReturn.current = null; }, []);
  useEffect(() => { if (state.notice) { showNotice(state.notice); controller.clearNotice(); } }, [controller, showNotice, state.notice]);
  const busy = state.loading || state.saving || state.deleting || state.openingReceipt;
  const heading = preparationFormulaHeading(options, state.estimatedMaterialKg);
  const total = preparationShareSummary(state.rows.map(row => row.percent));
  usePreventRemove(state.saving || state.deleting, () => {});
  const updateRow = (index: number, row: FormulaEditorRow) => controller.setRows(state.rows.map((old, i) => i === index ? row : old));
  const failure = (error: unknown) => showNotice(preparationFormulaErrorMessage(error));
  const remove = (formula: Formula) => Alert.alert(t('Formulani o‘chirish'), `«${formula.name}» formulasi o‘chirilsinmi?`, [
    { text: t('Bekor qilish'), style: 'cancel' }, { text: t('O‘chirish'), style: 'destructive', onPress: () => {
      void controller.remove(formula.name).then(removed => { if (removed) showNotice(t('Formula o‘chirildi')); }).catch(failure);
    } },
  ]);
  const openDetails = (formula: Formula) => {
    let selected: 'shares' | 'edit' | 'delete' | null = null;
    sheet.open(<FormulaDetails formula={formula} formulas={state.formulas} materialName={options.materialName} estimatedKg={state.estimatedMaterialKg}
      select={action => { selected = action; sheet.close(); }} />,
      { compact: true, dismissible: true, onDismiss: () => {
        if (selected === 'shares') setSharing(true);
        else if (selected === 'edit') controller.openEditor(formula);
        else if (selected === 'delete') remove(formula);
      } });
  };
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: state.variantName || t('Formulalar'), gestureEnabled: !state.saving && !state.deleting }} />
    <PreparationList refresh={() => controller.reload()}>
      <PreparationStatus loading={state.loading || state.saving || state.deleting} error={state.error} retry={() => { void controller.reload(); }} />
      <Section><Text>{heading.context}</Text><Text>{heading.code}</Text>{!!heading.subtitle && <Text>{heading.subtitle}</Text>}
        {heading.estimate !== null && <Text>{heading.estimate}</Text>}
      </Section>
      {state.editing && <>
        <Section><Text>{state.editingName === null ? t('Yangi formula') : `«${state.editingName}»`}</Text>
          {state.editingName === null && <><Text>{`Formula: ${preparationNextFormulaName(state.formulas.map(formula => formula.name))}`}</Text>
            <Text>{t('Nom avtomatik beriladi')}</Text></>}</Section>
        {state.rows.map((row, index) => <FormulaLine key={`${state.editingName ?? 'new'}:${index}:${row.material?.code ?? ''}`} row={row} index={index} materials={state.materials}
          busy={busy} canRemove={state.rows.length > 1} change={value => updateRow(index, value)} remove={() => controller.setRows(state.rows.filter((_, i) => i !== index))} />)}
        <Section><Button label={t('Seriyo qo‘shish')} modifiers={[disabled(busy)]} onPress={() => controller.setRows([...state.rows, { material: null, percent: '' }])} />
          <Text>{total.total === null ? 'Jami: —' : `Jami: ${total.total}%`}</Text><Text>{t('100% shart')}</Text>
          {!!state.editorError && <Text>{state.editorError}</Text>}
          <Button label={t(state.saving ? 'Saqlanmoqda…' : 'Saqlash')} modifiers={[disabled(!state.canSave || busy)]} onPress={() => {
            void controller.save().then(saved => { if (saved) showNotice(t('Formula saqlandi')); }).catch(failure);
          }} />
          <Button label={t('Bekor qilish')} modifiers={[disabled(busy)]} onPress={() => controller.closeEditor()} /></Section>
      </>}
      <Section>
        {!options.manageSavedFormula && canOpenRoute(session, appRoutes.gscaleMode) && <Button label={t('Ishlab chiqarishni boshlash')}
          modifiers={[disabled(busy)]} onPress={() => { void controller.startProduction(true, args => new Promise<void>((resolve, reject) => {
            scaleReturn.current = resolve;
            try { openPreparationScale(args); } catch (error) { scaleReturn.current = null; reject(error); }
          })).catch(failure); }} />}
        {state.formulas.length > 0 && <Button modifiers={[disabled(busy)]} onPress={() => setSharing(true)}><VStack alignment="leading">
          <Text>{t('Shnek ulushlari')}</Text><Text>{t(preparationFormulaSharesComplete(state.formulas)
            ? 'Jami: 100% • bitta umumiy tarkib' : 'Jami 100% qilib belgilang — kg shundan keyin hisoblanadi')}</Text></VStack></Button>}
        <Text>{`${options.variantName ? 'Ichki formulalar' : 'Saqlangan formulalar'} (${state.formulas.length})`}</Text>
        {!state.formulas.length && <Text>{t(options.manageSavedFormula && !options.allowAddingFormula ? 'Bu formulada ichki tarkib yo‘q.' : 'Hali formula yo‘q. FAB orqali formula qo‘shing.')}</Text>}
        {state.formulas.map(formula => {
          const card = preparationFormulaCard(formula, state.formulas, state.estimatedMaterialKg);
          return <VStack key={formula.name} alignment="leading"><Button modifiers={[disabled(busy)]} onPress={() => openDetails(formula)}>
            <VStack alignment="leading"><Text>{formula.name}</Text><Text>{card.count}</Text><Text>{card.share}</Text>
              {card.lines.map((line, index) => <Text key={index}>{line}</Text>)}</VStack></Button>
            <HStack><Button label={t('Tahrirlash')} modifiers={[disabled(busy)]} onPress={() => controller.openEditor(formula)} />
              <Button label={t('O‘chirish')} role="destructive" modifiers={[disabled(busy)]} onPress={() => remove(formula)} /></HStack>
          </VStack>;
        })}
        {(!options.manageSavedFormula || options.allowAddingFormula) && <Button
          label={t(options.manageSavedFormula ? 'Ichki formula qo‘shish' : 'Shnek formula qo‘shish')}
          modifiers={[disabled(busy)]} onPress={() => controller.openEditor()} />}
      </Section>
    </PreparationList>
    {sharing && <PreparationSharesDialog formulas={state.formulas} materialName={options.materialName} close={() => setSharing(false)}
      save={values => controller.saveShares(values)} />}<PreparationNotice message={noticeMessage} /></View>;
}
