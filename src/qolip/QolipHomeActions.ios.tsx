import { Alert, Button, Host, HStack, Image, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, frame, keyboardType } from '@expo/ui/swift-ui/modifiers';
import { KeyboardAvoidingView, Modal, PlatformColor, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { QolipHomeBlockChoiceProps, QolipHomeDialogModel, QolipHomeMenuProps } from './qolipHomeActionTypes';

export function QolipHomeMenu(props: QolipHomeMenuProps) {
  return <ScrollView contentContainerStyle={{ padding: 20 }}><Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={14}>
    {props.title && <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{props.title}</Text>}
    {props.subtitle && <Text>{props.subtitle}</Text>}
    {props.info && <Text>{props.info}</Text>}
    {props.actions.map((action, index) => <Button key={action.id} onPress={() => props.choose(action.id)} modifiers={[buttonStyle(index === 0 ? 'borderedProminent' : 'bordered'), disabled(!!action.disabled), frame({ minHeight: 50, maxWidth: Infinity })]}><HStack spacing={8}>{action.symbol && <Image systemName={action.symbol} size={18} />}<Text>{action.label}</Text></HStack></Button>)}
    {props.note && <Text>{props.note}</Text>}
  </VStack></Host></ScrollView>;
}
export function QolipHomeBlockChoice(props: QolipHomeBlockChoiceProps) {
  return <ScrollView contentContainerStyle={{ padding: 20 }}><Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={12}>
    <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{props.title}</Text>{props.blocks.map((block, index) => <Button key={`${block.name}:${index}`} onPress={() => props.choose(block)} modifiers={[buttonStyle('plain'), frame({ minHeight: 54, maxWidth: Infinity, alignment: 'leading' })]}>
      <VStack alignment="leading"><Text>{block.name}</Text><Text modifiers={[font({ textStyle: 'caption' })]}>{block.warehouse}</Text></VStack>
    </Button>)}
  </VStack></Host></ScrollView>;
}
export function QolipHomeDialog({ model }: { model: QolipHomeDialogModel | null }) {
  if (!model) return null;
  if (model.input !== undefined) return <QuantityDialog model={model} />;
  return <Host style={StyleSheet.absoluteFill} pointerEvents="none"><Alert title={model.title} isPresented onIsPresentedChange={value => { if (!value) model.close(); }}>
    <Alert.Trigger><Text> </Text></Alert.Trigger><Alert.Message><Text>{model.message ?? ''}</Text></Alert.Message>
    <Alert.Actions><Button label={model.cancel} role="cancel" onPress={model.close} /><Button label={model.confirm} onPress={model.accept} /></Alert.Actions>
  </Alert></Host>;
}
function QuantityDialog({ model }: { model: QolipHomeDialogModel }) {
  const input = useNativeState(model.input ?? '');
  return <Modal transparent visible animationType="fade" onRequestClose={model.close}><KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#00000052' }}>
    <Pressable style={StyleSheet.absoluteFill} onPress={model.close} /><View accessibilityViewIsModal style={{ borderRadius: 22, padding: 22, backgroundColor: PlatformColor('secondarySystemBackground') }}><Host matchContents={{ vertical: true }}><VStack spacing={14}>
      <Text modifiers={[font({ textStyle: 'headline' })]}>{model.title}</Text><TextField text={input} autoFocus onTextChange={value => { const filtered = value.replace(/[^0-9]/g, ''); if (filtered !== value) input.set(filtered); model.change(filtered); }} modifiers={[keyboardType('numeric')]} />
      {model.helper && <Text>{model.helper}</Text>}{model.error && <Text>{model.error}</Text>}
      <Button label={model.confirm} onPress={model.accept} modifiers={[buttonStyle('borderedProminent'), frame({ minHeight: 48, maxWidth: Infinity })]} />
      <Button label={model.cancel} role="cancel" onPress={model.close} modifiers={[frame({ minHeight: 44, maxWidth: Infinity })]} />
    </VStack></Host></View>
  </KeyboardAvoidingView></Modal>;
}
