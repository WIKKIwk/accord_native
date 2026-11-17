import { Button, CircularProgressIndicator, Column, Host, OutlinedButton, OutlinedTextField, RNHostView, Row, Text, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, size } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { localizedMethod } from '../shared/localization';
import { useQolipTake, type QolipTakeProps } from './useQolipTake';
import { useQolipText } from './useQolipText';

/** @v2 _QolipTakeSheet */
export function QolipTakeSheet(props: QolipTakeProps) {
  const state = useQolipTake(props), quantity = useNativeState('1'), colors = useMaterialColors(), { locale } = useQolipText();
  if (!state.valid) return null;
  return <KeyboardAvoidingView behavior="padding"><ScrollView contentContainerStyle={{ padding: 16 }}><Host matchContents={{ vertical: true }}><Column verticalArrangement={{ spacedBy: 14 }}>
    <Text style={{ typography: 'titleLarge', fontWeight: '800' }}>{state.text('home.take')}</Text>
    <Text>{`${props.item.item_name} • ${props.item.qolip_code} • ${localizedMethod('qolipCount', locale, { count: props.item.quantity })}`}</Text>
    <OutlinedButton enabled={!state.busy} onClick={state.selectWorker} modifiers={[fillMaxWidth(), height(54)]}><Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center"><RNHostView matchContents><SymbolView name={{ android: 'person_search' }} size={20} /></RNHostView><Text>{state.worker ? [state.worker.name, state.worker.level.trim()].filter(Boolean).join(' • ') : state.text('home.choose_worker')}</Text></Row></OutlinedButton>
    <OutlinedTextField value={quantity} enabled={!state.busy} singleLine keyboardOptions={{ keyboardType: 'number' }} onValueChange={value => { state.setQuantity(value); const filtered = value.replace(/[^0-9]/g, ''); if (filtered !== value) quantity.set(filtered); }} modifiers={[fillMaxWidth()]}>
      <OutlinedTextField.Label><Text>{state.text('home.mold_count')}</Text></OutlinedTextField.Label>
      <OutlinedTextField.SupportingText><Text>{state.text('home.max_count', { count: props.item.quantity })}</Text></OutlinedTextField.SupportingText>
    </OutlinedTextField>
    {state.error && <Text color={colors.error}>{state.error}</Text>}
    <Button enabled={!state.busy} onClick={state.submit} modifiers={[fillMaxWidth(), height(54)]}>{state.busy ? <CircularProgressIndicator modifiers={[size(18, 18)]} /> : <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center"><RNHostView matchContents><SymbolView name={{ android: 'assignment_returned' }} size={20} /></RNHostView><Text>{state.text('home.borrow')}</Text></Row>}</Button>
  </Column></Host></ScrollView></KeyboardAvoidingView>;
}
