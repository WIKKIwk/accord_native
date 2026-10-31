import { FilledTonalIconButton, Host, IconButton, RNHostView } from '@expo/ui/jetpack-compose';
import { semantics, size } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import type { WorkerIconButtonProps } from './workerDialogTypes';
import { useWorkerColors } from './useWorkerColors';

export function WorkerIconButton({ icon, label, onPress, tonal }: WorkerIconButtonProps) {
  const colors = useWorkerColors();
  const Component = tonal ? FilledTonalIconButton : IconButton;
  return <Host matchContents style={{ width: 40, height: 40 }}>
    <Component onClick={onPress} modifiers={[size(40, 40), semantics({ contentDescription: label })]}>
      <RNHostView matchContents><SymbolView name={{ android: icon }} size={20} tintColor={colors.icon} /></RNHostView>
    </Component>
  </Host>;
}
