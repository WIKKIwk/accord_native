import { Button, Host, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
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
