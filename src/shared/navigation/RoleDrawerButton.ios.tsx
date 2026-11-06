import { Button, Host } from '@expo/ui/swift-ui';
import { labelStyle } from '@expo/ui/swift-ui/modifiers';
import { useRoleDrawer } from './roleDrawerContext';

export function RoleDrawerButton({ label }: { label: string }) {
  const drawer = useRoleDrawer();
  return <Host matchContents><Button label={label} systemImage="line.3.horizontal"
    modifiers={[labelStyle('iconOnly')]} onPress={drawer.open} /></Host>;
}
