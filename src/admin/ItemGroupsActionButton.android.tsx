import { Button, Host, Shape, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, testID } from '@expo/ui/jetpack-compose/modifiers';
import type { ItemGroupsActionButtonProps } from './itemGroupsControlTypes';
/** V2 app_theme filledButtonTheme: 56-point minimum and 20-point corners. */
export function ItemGroupsActionButton({ label, onPress, disabled }: ItemGroupsActionButtonProps) {
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Button enabled={!disabled} onClick={onPress}
    shape={Shape.RoundedCorner({ cornerRadii: { topStart: 20, topEnd: 20, bottomStart: 20, bottomEnd: 20 } })} modifiers={[fillMaxWidth(), height(56), testID('item-groups-submit')]}>
    <Text>{label}</Text></Button></Host>;
}
