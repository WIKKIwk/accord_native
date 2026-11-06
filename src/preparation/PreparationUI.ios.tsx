import { Button, Host, List, ProgressView, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled, keyboardType, listStyle, refreshable } from '@expo/ui/swift-ui/modifiers';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { localeController } from '../shared/localization/runtime';
import { uiText } from '../shared/localization';
import { preparationInputError } from './preparationLogic';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function usePreparationText() {
  const locale = useSyncExternalStore(subscribe, currentLocale, currentLocale);
  return (source: string) => uiText(source, locale);
}
export function PreparationList({ children, refresh }: { children: ReactNode; refresh?: () => Promise<void> }) {
  return <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped'), ...(refresh ? [refreshable(refresh)] : [])]}>{children}</List></Host>;
}
export function PreparationStatus({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) {
  const t = usePreparationText();
  return <>{loading && <ProgressView />}{!!error && <Section><Text>{t('Xatolik yuz berdi')}</Text><Text>{error}</Text>
    <Button label={t('Qayta urinish')} onPress={retry} /></Section>}</>;
}
export function preparationAlert(error: unknown) {
  Alert.alert('Xatolik yuz berdi', error instanceof Error ? error.message : String(error));
}

// @v2 _PreparationInputDialog
export function PreparationInputSheet({ title, label, initial = '', quantity = false, maxLength, emptyError, close, save }: {
  title: string; label: string; initial?: string; quantity?: boolean; maxLength?: number; emptyError?: string;
  close: () => void; save: (value: string) => Promise<void>;
}) {
  const t = usePreparationText();
  const input = useNativeState(initial);
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const invalid = preparationInputError(value, { quantity, maxLength, emptyError });
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError(null);
    try { await save(value.trim()); close(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <Host style={{ minHeight: 250 }}><VStack spacing={14}>
    <Text>{t(title)}</Text><TextField text={input} placeholder={t(label)} onTextChange={setValue}
      modifiers={[disabled(busy), ...(quantity ? [keyboardType('decimal-pad')] : [])]} />
    {!!error && <Text>{t(error)}</Text>}
    <Button label={t('Saqlash')} modifiers={[disabled(busy)]} onPress={() => { void submit(); }} />
    <Button label={t('Bekor qilish')} role="cancel" modifiers={[disabled(busy)]} onPress={close} />
  </VStack></Host>;
}
