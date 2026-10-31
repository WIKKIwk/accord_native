import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import { SymbolView } from 'expo-symbols';
import { PlatformColor, StyleSheet, View } from 'react-native';

type Props = { onSelect: (id: string) => void; onScan: () => void; bottomOffset?: number };

const actions: MenuAction[] = [
  { id: 'scan', title: 'QR kodni skanerlash', image: 'qrcode.viewfinder' },
  { id: 'daily', title: 'Kunlik ishlar', image: 'calendar' },
  { id: 'paddons', title: 'Paddonlar', image: 'shippingbox' },
];

export function WorkerFab({ onSelect, onScan, bottomOffset = 88 }: Props) {
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <MenuView actions={actions} style={[styles.menu, { bottom: bottomOffset }]}
      onPressAction={event => {
        const id = event.nativeEvent.event;
        if (id === 'scan') onScan();
        else onSelect(id);
      }}>
      <View style={styles.trigger} accessibilityRole="button" accessibilityLabel="Amallar">
        <SymbolView name="plus.circle.fill" size={44} tintColor={PlatformColor('systemBlue')} />
      </View>
    </MenuView>
  </View>;
}

const styles = StyleSheet.create({
  menu: { position: 'absolute', right: 16, width: 56, height: 56 },
  trigger: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
