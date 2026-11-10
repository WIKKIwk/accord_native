import { Button, Host, Image } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonBorderShape, buttonStyle, controlSize, frame, labelStyle } from '@expo/ui/swift-ui/modifiers';
import { Platform } from 'react-native';
import type { WorkerIconButtonProps } from './workerDialogTypes';
import { useWorkerColors } from './useWorkerColors';

export function WorkerIconButton({ icon, label, onPress, tonal }: WorkerIconButtonProps) {
  const colors = useWorkerColors();
  if (icon === 'close') {
    const glass = Number(Platform.Version) >= 26;
    return <Host matchContents>
      <Button {...(glass ? { role: 'close' as const } : { label, systemImage: 'xmark' as const })} onPress={onPress}
        modifiers={[buttonStyle(glass ? 'glass' : 'bordered'), buttonBorderShape('circle'), controlSize('large'), labelStyle('iconOnly'), accessibilityLabel(label)]} />
    </Host>;
  }
  const symbol = icon === 'edit' ? 'pencil' : icon === 'back' ? 'arrow.left' : icon === 'photo' ? 'photo.badge.plus' : icon === 'scannedWips' ? 'qrcode.viewfinder' : 'checkmark';
  return <Host matchContents>
    <Button onPress={onPress} modifiers={[frame({ width: 44, height: 44 }), buttonStyle(tonal ? Number(Platform.Version) >= 26 ? 'glass' : 'bordered' : 'plain'), buttonBorderShape('circle'), accessibilityLabel(label)]}>
      <Image systemName={symbol} size={17} color={colors.icon} />
    </Button>
  </Host>;
}
