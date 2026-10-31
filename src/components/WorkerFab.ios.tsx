import { Button, Host, Image } from '@expo/ui/swift-ui';
import { accessibilityLabel, background, buttonStyle, clipShape, foregroundStyle, frame } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Pressable, StyleSheet, View } from 'react-native';

type Props = { onSelect: (id: string) => void; onScan: () => void; bottomOffset?: number };
const actions = [
  { id: 'scan', label: 'QR kodni skanerlash', icon: 'qrcode.viewfinder', width: 234 },
  { id: 'daily', label: 'Kunlik ishlar', icon: 'calendar', width: 164 },
  { id: 'paddons', label: 'Paddonlar', icon: 'shippingbox', width: 150 },
] as const;

export function WorkerFab({ onSelect, onScan, bottomOffset = 88 }: Props) {
  const [open, setOpen] = useState(false);
  const [renderActions, setRenderActions] = useState(false);
  const progress = useRef(actions.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (open) {
      setRenderActions(true);
      Animated.stagger(35, [...progress].reverse().map(value => Animated.spring(value, {
        toValue: 1, damping: 18, stiffness: 260, mass: 0.8, useNativeDriver: true,
      }))).start();
    } else {
      Animated.stagger(25, progress.map(value => Animated.timing(value, {
        toValue: 0, duration: 130, useNativeDriver: true,
      }))).start(({ finished }) => { if (finished) setRenderActions(false); });
    }
    return () => { progress.forEach(value => value.stopAnimation()); };
  }, [open, progress]);

  useEffect(() => {
    if (!open) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { setOpen(false); return true; });
    return () => listener.remove();
  }, [open]);

  function select(id: string) {
    setOpen(false);
    if (id === 'scan') onScan();
    else onSelect(id);
  }

  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {open ? <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Amallarni yopish" accessibilityRole="button" /> : null}
    {renderActions ? actions.map((action, index) => <Animated.View
      key={action.id}
      pointerEvents={open ? 'auto' : 'none'}
      style={[styles.action, { width: action.width, bottom: bottomOffset + 88 + (actions.length - 1 - index) * 64,
        opacity: progress[index], transform: [{ translateY: progress[index].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: progress[index].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
      <Host style={{ width: action.width, height: 56 }} colorScheme="light">
        <Button label={action.label} systemImage={action.icon} onPress={() => select(action.id)} modifiers={[
          buttonStyle('plain'), frame({ width: action.width, height: 56 }), background('#d9eadd'),
          clipShape('capsule'), foregroundStyle('#183d2b'), accessibilityLabel(action.label),
        ]} />
      </Host>
    </Animated.View>) : null}
    <Host style={[styles.fab, { bottom: bottomOffset }]} colorScheme="light">
      <Button onPress={() => setOpen(value => !value)} modifiers={[
        buttonStyle('plain'), frame({ width: 80, height: 80 }), background('#285140'),
        clipShape(open ? 'circle' : 'roundedRectangle', 24), accessibilityLabel(open ? 'Amallarni yopish' : 'Amallarni ochish'),
      ]}>
        <Image systemName={open ? 'xmark' : 'plus'} size={32} color="#ffffff" />
      </Button>
    </Host>
  </View>;
}
const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 16, width: 80, height: 80 },
  action: { position: 'absolute', right: 16, height: 56 },
});
