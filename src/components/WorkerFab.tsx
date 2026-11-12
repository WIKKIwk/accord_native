import { Button, Host, RNHostView, Row, Text } from '@expo/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

type Props = { onSelect: (id: string) => void; onScan: () => void; showPaddons: boolean; bottomOffset?: number };
type Action = { id: string; label: string; symbol: SymbolViewProps['name'] };
const actions: Action[] = [
  { id: 'scan', label: 'QR kodni skanerlash', symbol: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' } },
  { id: 'daily', label: 'Kunlik ishlar', symbol: { ios: 'calendar', android: 'today', web: 'today' } },
  { id: 'paddons', label: 'Paddonlar', symbol: { ios: 'shippingbox', android: 'inventory_2', web: 'inventory_2' } },
];
export function WorkerFab({ onSelect, onScan, showPaddons, bottomOffset = 80 }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setOpen(false); return true; });
    return () => sub.remove();
  }, [open]);
  const select = (id: string) => { setOpen(false); if (id === 'scan') onScan(); else if (id !== 'paddons' || showPaddons) onSelect(id); };
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {open ? <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Amallarni yopish" /> : null}
    {open ? <View style={[styles.actions, { bottom: bottomOffset + 88 }]}>
      {actions.filter(action => action.id !== 'paddons' || showPaddons).map(action => <Host key={action.id} matchContents colorScheme="light" seedColor="#285140">
        <Button variant="filled" onPress={() => select(action.id)}>
          <Row alignment="center" spacing={12}>
            <RNHostView matchContents><SymbolView name={action.symbol} size={22} tintColor="#193c2c" /></RNHostView>
            <Text textStyle={{ color: '#193c2c', fontSize: 15, fontWeight: '600' }}>{action.label}</Text>
          </Row>
        </Button>
      </Host>)}
    </View> : null}
    <Host colorScheme="light" seedColor="#285140" style={[styles.fab, { bottom: bottomOffset }]}>
      <Button variant="filled" style={{ width: 80, height: 80, borderRadius: 24 }} onPress={() => setOpen(value => !value)}>
        <RNHostView matchContents><SymbolView name={{ ios: open ? 'xmark' : 'plus', android: open ? 'close' : 'add', web: open ? 'close' : 'add' }} size={32} tintColor="#fff" /></RNHostView>
      </Button>
    </Host>
  </View>;
}
const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 16, width: 80, height: 80 },
  actions: { position: 'absolute', right: 16, alignItems: 'flex-end', gap: 8 },
});
