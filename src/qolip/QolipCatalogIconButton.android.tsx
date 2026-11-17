import { Host, IconButton, RNHostView } from '@expo/ui/jetpack-compose';
import { semantics, size } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { useWorkerColors } from '../components/useWorkerColors';
export function QolipCatalogIconButton({ icon, label, onPress, disabled }: { icon: AndroidSymbol; label: string; onPress(): void; disabled?: boolean }) {
  const colors = useWorkerColors();
  return <Host style={{ width: 48, height: 48 }}><IconButton enabled={!disabled} onClick={onPress} modifiers={[size(48, 48), semantics({ contentDescription: label })]}>
    <RNHostView matchContents><SymbolView name={{ android: icon }} size={24} tintColor={colors.icon} /></RNHostView>
  </IconButton></Host>;
}
