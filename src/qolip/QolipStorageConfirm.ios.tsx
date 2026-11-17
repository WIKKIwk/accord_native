import { Button, Host, HStack, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, frame } from '@expo/ui/swift-ui/modifiers';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import type { StorageConfirmation } from './qolipStorageViewProps';
export function QolipStorageConfirm({ value }: { value: StorageConfirmation }) {
  const colors = useWorkerColors(), { height } = useWindowDimensions();
  const confirm = <Button label={value.confirm} role={value.destructive ? 'destructive' : undefined} onPress={() => value.resolve(true)} modifiers={[buttonStyle('borderedProminent'), frame({ maxWidth: Infinity, minHeight: 48 })]} />;
  const cancel = <Button label={value.cancel} role="cancel" onPress={() => value.resolve(false)} modifiers={[buttonStyle('bordered'), frame({ maxWidth: Infinity, minHeight: 48 })]} />;
  return <Modal visible transparent animationType="fade" onRequestClose={() => value.resolve(false)}><View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0006' }}>
    <Pressable style={{ position: 'absolute', inset: 0 }} onPress={() => value.resolve(false)} />
    <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '600', color: colors.text }}>{value.title}</Text>
      <ScrollView style={{ maxHeight: height * 0.5 }}><Text style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{value.message}</Text></ScrollView>
      <Host matchContents>{value.destructive ? <VStack spacing={10}>{confirm}{cancel}</VStack> : <HStack spacing={12}>{cancel}{confirm}</HStack>}</Host>
    </View>
  </View></Modal>;
}

/** @v2 _StorageOverlay — the expired dialog has only the source message. */
export function QolipStorageExpiredDialog({ message, close, barrierDismissible = true }: { message: string; close(): void; barrierDismissible?: boolean }) {
  const colors = useWorkerColors();
  return <Modal visible transparent animationType="fade" onRequestClose={close}><View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0006' }}>
    <Pressable style={{ position: 'absolute', inset: 0 }} disabled={!barrierDismissible} onPress={close} />
    <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 24 }}>
      <Text style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{message}</Text>
    </View>
  </View></Modal>;
}
