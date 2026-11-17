import { Alert, Button, Host, Text } from '@expo/ui/swift-ui';
import { useWindowDimensions } from 'react-native';
import type { QolipCatalogConfirmation } from './qolipCatalogConfirmation';
export function QolipCatalogConfirm({ value }: { value: QolipCatalogConfirmation | null }) {
  const { width, height } = useWindowDimensions(); if (!value) return null;
  return <Host style={{ position: 'absolute', top: 0, width, height }} pointerEvents="none"><Alert title={value.title} isPresented
    onIsPresentedChange={presented => { if (!presented) value.resolve(false); }}>
    <Alert.Trigger><Text> </Text></Alert.Trigger><Alert.Message><Text>{value.message}</Text></Alert.Message><Alert.Actions>
      {value.cancel && <Button label={value.cancel} role="cancel" onPress={() => value.resolve(false)} />}
      <Button label={value.confirm} onPress={() => value.resolve(true)} />
    </Alert.Actions></Alert></Host>;
}
