import { Button, Host, ProgressView, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, frame, keyboardType } from '@expo/ui/swift-ui/modifiers';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { localizedMethod } from '../shared/localization';
import { useQolipTake, type QolipTakeProps } from './useQolipTake';
import { useQolipText } from './useQolipText';

/** @v2 _QolipTakeSheet */
export function QolipTakeSheet(props: QolipTakeProps) {
  const state = useQolipTake(props), quantity = useNativeState('1'), { locale } = useQolipText();
  if (!state.valid) return null;
  return <KeyboardAvoidingView behavior="padding"><ScrollView contentContainerStyle={{ padding: 20 }}><Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={14}>
    <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{state.text('home.take')}</Text>
    <Text>{`${props.item.item_name} • ${props.item.qolip_code} • ${localizedMethod('qolipCount', locale, { count: props.item.quantity })}`}</Text>
    <Button onPress={state.selectWorker} modifiers={[buttonStyle('bordered'), disabled(state.busy), frame({ minHeight: 48, maxWidth: Infinity })]}><Text>{state.worker ? [state.worker.name, state.worker.level.trim()].filter(Boolean).join(' • ') : state.text('home.choose_worker')}</Text></Button>
    <Text>{state.text('home.mold_count')}</Text><TextField text={quantity} onTextChange={value => { state.setQuantity(value); const filtered = value.replace(/[^0-9]/g, ''); if (filtered !== value) quantity.set(filtered); }} modifiers={[keyboardType('numeric'), disabled(state.busy)]} />
    <Text>{state.text('home.max_count', { count: props.item.quantity })}</Text>{state.error && <Text>{state.error}</Text>}
    <Button onPress={state.submit} modifiers={[buttonStyle('borderedProminent'), disabled(state.busy), frame({ minHeight: 50, maxWidth: Infinity })]}><Text>{state.text('home.borrow')}</Text></Button>{state.busy && <ProgressView />}
  </VStack></Host></ScrollView></KeyboardAvoidingView>;
}
