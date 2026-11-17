import { AlertDialog, Button, Column, FilledTonalButton, Host, OutlinedTextField, RNHostView, Row, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ScrollView, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import type { QolipHomeBlockChoiceProps, QolipHomeDialogModel, QolipHomeMenuProps } from './qolipHomeActionTypes';

export function QolipHomeMenu(props: QolipHomeMenuProps) {
  const colors = useMaterialColors();
  return <ScrollView contentContainerStyle={{ padding: 16 }}><Host matchContents={{ vertical: true }}><Column verticalArrangement={{ spacedBy: 12 }}>
    {props.title && <Text style={{ typography: 'titleLarge', fontWeight: '800' }}>{props.title}</Text>}
    {props.subtitle && <Text>{props.subtitle}</Text>}
    {props.info && <Text color={colors.onSecondaryContainer}>{props.info}</Text>}
    {props.actions.map((action, index) => index === 0 ? <Button key={action.id} enabled={!action.disabled} onClick={() => props.choose(action.id)} modifiers={[fillMaxWidth(), height(54)]}><Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">{action.icon && <RNHostView matchContents><SymbolView name={{ android: action.icon }} size={20} tintColor={colors.onPrimary} /></RNHostView>}<Text>{action.label}</Text></Row></Button>
      : <FilledTonalButton key={action.id} enabled={!action.disabled} onClick={() => props.choose(action.id)} modifiers={[fillMaxWidth(), height(54)]}><Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">{action.icon && <RNHostView matchContents><SymbolView name={{ android: action.icon }} size={20} tintColor={colors.onSecondaryContainer} /></RNHostView>}<Text>{action.label}</Text></Row></FilledTonalButton>)}
    {props.note && <Text>{props.note}</Text>}
  </Column></Host></ScrollView>;
}
export function QolipHomeBlockChoice(props: QolipHomeBlockChoiceProps) {
  const colors = useMaterialColors();
  return <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}><Host matchContents><Text style={{ typography: 'titleLarge', fontWeight: '800' }}>{props.title}</Text></Host>
    {props.blocks.map((block, index) => <WorkerQueueCard key={`${block.name}:${index}`} first={index === 0} last={index === props.blocks.length - 1} backgroundColor={colors.surfaceContainerHigh} onPress={() => props.choose(block)}>
      <View style={{ flex: 1, paddingVertical: 8 }}><NativeText style={{ color: colors.onSurface, fontSize: 17 }}>{block.name}</NativeText><NativeText style={{ color: colors.onSurfaceVariant }}>{block.warehouse}</NativeText></View>
    </WorkerQueueCard>)}
  </ScrollView>;
}
export function QolipHomeDialog({ model }: { model: QolipHomeDialogModel | null }) {
  const { width, height: screenHeight } = useWindowDimensions();
  if (!model) return null;
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height: screenHeight }} pointerEvents="none"><AlertDialog onDismissRequest={model.close}>
    <AlertDialog.Title><Text>{model.title}</Text></AlertDialog.Title>
    <AlertDialog.Text>{model.input !== undefined ? <QuantityInput model={model} /> : <Text>{model.message ?? ''}</Text>}</AlertDialog.Text>
    <AlertDialog.DismissButton><TextButton onClick={model.close}><Text>{model.cancel}</Text></TextButton></AlertDialog.DismissButton>
    <AlertDialog.ConfirmButton><TextButton onClick={model.accept}><Text>{model.confirm}</Text></TextButton></AlertDialog.ConfirmButton>
  </AlertDialog></Host>;
}
function QuantityInput({ model }: { model: QolipHomeDialogModel }) {
  const input = useNativeState(model.input ?? ''), colors = useMaterialColors();
  return <Column><OutlinedTextField value={input} singleLine keyboardOptions={{ keyboardType: 'number' }} onValueChange={value => {
    const filtered = value.replace(/[^0-9]/g, ''); if (filtered !== value) input.set(filtered); model.change(filtered);
  }} modifiers={[fillMaxWidth()]} />{model.helper && <Text>{model.helper}</Text>}{model.error && <Text color={colors.error}>{model.error}</Text>}</Column>;
}
