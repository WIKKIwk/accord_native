import { Button, RNHostView, Row, Shape } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxSize, height, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminCreateHubFloating } from './AdminCreateHubFloating';
import type { AdminCreateHubNativeProps } from './AdminCreateHubTypes';
import { AdminText } from './AdminTypography.android';
import type { AdminCreateHubRenderSlotProps } from './adminSourceHubPlacementTypes';

const icons: Record<string, AndroidSymbol> = { group_add_outlined: 'group_add', inventory_2_outlined: 'inventory_2', qr_code_scanner_rounded: 'qr_code_scanner', list_alt_outlined: 'list_alt', add_task_outlined: 'add_task' };
/** @v2 _AdminCreateHubOverlay and _AppPrimaryNavigationButton */
export function AdminCreateHubHost(props: AdminCreateHubNativeProps & AdminCreateHubRenderSlotProps) {
  const { colors } = useBaseTheme();
  return <AdminCreateHubFloating {...props} render={{
    icon: (name, color) => <SymbolView name={{ android: name }} size={24} tintColor={color} importantForAccessibility="no" />,
    toggle: (label, onPress, children, id) => <BaseHost style={{ width: '100%', height: '100%' }}><Button onClick={onPress} shape={Shape.RoundedCorner({ cornerRadii: { topStart: 0, topEnd: 0, bottomStart: 0, bottomEnd: 0 } })}
      contentPadding={{ start: 0, end: 0, top: 0, bottom: 0 }} colors={{ containerColor: 'transparent', contentColor: colors.onPrimaryContainer }} modifiers={[fillMaxSize(), defaultMinSize({ minWidth: 0, minHeight: 0 }), semantics({ contentDescription: label }), testID(id)]}>
      <RNHostView matchContents><View>{children}</View></RNHostView></Button></BaseHost>,
    action: (action, onPress) => <BaseHost matchContents><Button onClick={onPress} enabled={action.enabled} shape={Shape.Pill({})}
      colors={{ containerColor: colors.primaryContainer, contentColor: colors.onPrimaryContainer, disabledContainerColor: colors.surfaceContainerHigh, disabledContentColor: colors.onSurfaceVariant }}
      contentPadding={{ start: 14, end: 14, top: 0, bottom: 0 }} modifiers={[height(56), defaultMinSize({ minWidth: 56, minHeight: 0 }), semantics({ contentDescription: action.label }), testID(action.id)]}>
      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 10 }}><RNHostView matchContents><SymbolView name={{ android: action.icon?.android ?? icons[action.materialIcon!] }} size={24} tintColor={action.enabled ? colors.onPrimaryContainer : colors.onSurfaceVariant} importantForAccessibility="no" /></RNHostView>
        <AdminText style={{ typography: 'titleMedium', fontWeight: '600' }} maxLines={1} overflow="ellipsis">{action.label}</AdminText>
      </Row>
    </Button></BaseHost>,
  }} />;
}
