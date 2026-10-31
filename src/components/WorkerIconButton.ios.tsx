import { Button, Host, Image } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, frame } from '@expo/ui/swift-ui/modifiers';
import type { WorkerIconButtonProps } from './workerDialogTypes';
import { useWorkerColors } from './useWorkerColors';

export function WorkerIconButton({ icon, label, onPress, tonal }: WorkerIconButtonProps) {
  const colors = useWorkerColors();
  const symbol = icon === 'close' ? 'xmark' : icon === 'edit' ? 'pencil' : 'checkmark';
  return <Host matchContents style={{ width: 40, height: 40 }}>
    <Button onPress={onPress} modifiers={[frame({ width: 40, height: 40 }), buttonStyle(tonal ? 'bordered' : 'plain'), accessibilityLabel(label)]}>
      <Image systemName={symbol} size={20} color={colors.icon} />
    </Button>
  </Host>;
}
