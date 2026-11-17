import { Button, Host, Menu } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled, labelStyle } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';
import { useAdminCreateMenu, type AdminCreateMenuProps } from './useAdminCreateMenu';

/** Native iOS action menu preserves V2's action order and close-before-action sequence. */
export function AdminCreateMenu(props: AdminCreateMenuProps) {
  const { state, controller } = useAdminCreateMenu(props);
  if (props.visible === false || !state.actions.length) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <Host matchContents style={[styles.trigger, { bottom: props.bottomOffset ?? 94 },props.alignEnd===false?{right:undefined,left:10}:null]}>
      <Menu label={props.openLabel} systemImage="plus" modifiers={[labelStyle('iconOnly'), controlSize('large'), buttonStyle('borderedProminent')]}>
        {state.actions.map(action => <Button key={action.id} label={action.label} systemImage={action.icon.ios}
          modifiers={[disabled(action.enabled === false)]} onPress={() => { void controller.select(action.id); }} />)}
      </Menu>
    </Host>
  </View>;
}
const styles = StyleSheet.create({ trigger: { position: 'absolute', right: 16, width: 64, height: 64 } });
