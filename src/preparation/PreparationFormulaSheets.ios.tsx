import { Button, Host, List, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled, keyboardType } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { preparationFormulaShareInputs } from './preparationLogic';
import { preparationDecimalText, preparationDisplay, preparationFormulaShareTotal, type PreparationFormula } from './preparationModel';
import { preparationVariantNameCanSave } from './usePreparationLibrary';
import { usePreparationText } from './PreparationUI';

// @v2 _VariantNameDialog
export function PreparationVariantNameSheet({ initial = '', close, save }: {
  initial?: string; close: () => void; save: (name: string) => Promise<void>;
}) {
  const t = usePreparationText(), nativeValue = useNativeState(initial);
  const [value, setValue] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async () => {
    if (!preparationVariantNameCanSave(value, initial || null)) return;
    setBusy(true); setError('');
    try { await save(value); close(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <Host style={{ minHeight: 240 }}><VStack spacing={12}><Text>{t(initial ? 'Nomini o‘zgartirish' : 'Variant qo‘shish')}</Text>
    <TextField text={nativeValue} placeholder={t('Variant nomi')} onTextChange={setValue} modifiers={[disabled(busy)]} />
    {!!error && <Text>{error}</Text>}
    <Button label={t('Saqlash')} modifiers={[disabled(busy || !preparationVariantNameCanSave(value, initial || null))]} onPress={() => { void submit(); }} />
    <Button label={t('Bekor qilish')} modifiers={[disabled(busy)]} onPress={close} />
  </VStack></Host>;
}

function ShareField({ formula, change, busy }: { formula: PreparationFormula; change: (value: string) => void; busy: boolean }) {
  const nativeValue = useNativeState(formula.share_percent ?? '');
  return <Section title={formula.name}><TextField text={nativeValue} placeholder="%" onTextChange={change}
    modifiers={[keyboardType('decimal-pad'), disabled(busy)]} /></Section>;
}

// @v2 _FormulaSharesSheet
export function PreparationSharesSheet({ formulas, close, save }: {
  formulas: PreparationFormula[]; close: () => void; save: (values: string[]) => Promise<void>;
}) {
  const t = usePreparationText();
  const [values, setValues] = useState(formulas.map(formula => formula.share_percent ?? ''));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const total = preparationFormulaShareTotal(formulas.map((formula, index) => ({ ...formula, share_percent: values[index] })));
  let valid = false;
  try { preparationFormulaShareInputs(formulas.map(formula => formula.name), values); valid = true; } catch { /* Shared validation gives the exact 100% rule. */ }
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try { await save(values); close(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <Host style={{ minHeight: 360 }}><VStack><Text>{t('Shnek ulushlarini belgilash')}</Text><List>
    {formulas.map((formula, index) => <ShareField key={formula.name} formula={formula} busy={busy} change={value =>
      setValues(current => current.map((old, i) => i === index ? value : old))} />)}
    <Text>{total === null ? t('Har bir shnek uchun 0 dan katta, 100 gacha foiz kiriting') : t(`Jami: ${preparationDisplay(preparationDecimalText(total))}% / 100%`)}</Text>
    {!!error && <Text>{error}</Text>}
  </List><Button label={t('Saqlash')} modifiers={[disabled(!valid || busy)]} onPress={() => { void submit(); }} />
    <Button label={t('Bekor qilish')} modifiers={[disabled(busy)]} onPress={close} /></VStack></Host>;
}
