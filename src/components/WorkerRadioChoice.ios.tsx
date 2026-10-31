import { Button, Host } from '@expo/ui/swift-ui';
import { accessibilityValue, buttonStyle, disabled as disable } from '@expo/ui/swift-ui/modifiers';
import type { WorkerRadioChoiceProps } from './workerDialogTypes';

export function WorkerRadioChoice({ label, selected, disabled, onPress }: WorkerRadioChoiceProps) {
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Button label={label} systemImage={selected ? 'checkmark.circle.fill' : 'circle'} onPress={onPress}
      modifiers={[buttonStyle('plain'), accessibilityValue(selected ? 'Tanlangan' : 'Tanlanmagan'), disable(!!disabled)]} />
  </Host>;
}
