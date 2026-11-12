import { useWorkerOrderText } from './useWorkerOrderText';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import { SymbolView } from 'expo-symbols';
import { PlatformColor, StyleSheet, View } from 'react-native';

type Props = { onSelect: (id: string) => void; onScan: () => void; showPaddons: boolean; bottomOffset?: number };

const actions: MenuAction[] = [
  { id: 'scan', title: 'QR scan qilish', image: 'qrcode.viewfinder' },
  { id: 'daily', title: 'Kunlik ish', image: 'calendar' },
  { id: 'paddons', title: 'Paddonlar', image: 'shippingbox' },
];

export function WorkerFab({ onSelect, onScan, showPaddons, bottomOffset = 88 }: Props) {
  const { t } = useWorkerOrderText();
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <MenuView actions={actions.filter(action => action.id !== 'paddons' || showPaddons).map(action => ({ ...action, title: t(action.title) }))} style={[styles.menu, { bottom: bottomOffset }]}
      onPressAction={event => {
        const id = event.nativeEvent.event;
        if (id === 'scan') onScan();
        else if (id !== 'paddons' || showPaddons) onSelect(id);
      }}>
      <View style={styles.trigger} accessibilityRole="button" accessibilityLabel={t('Amallar')}>
        <SymbolView name="plus.circle.fill" size={44} tintColor={PlatformColor('systemBlue')} />
      </View>
    </MenuView>
  </View>;
}

const styles = StyleSheet.create({
  menu: { position: 'absolute', right: 16, width: 56, height: 56 },
  trigger: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
