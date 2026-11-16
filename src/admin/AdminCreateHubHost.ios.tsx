import { Button, HStack, Image, RNHostView, Text } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, cornerRadius, disabled, font, foregroundStyle, frame, lineLimit, padding } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'expo-symbols';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminCreateHubFloating } from './AdminCreateHubFloating';
import type { AdminCreateHubNativeProps } from './AdminCreateHubTypes';

const icons: Record<string, SFSymbol> = { group_add_outlined: 'person.badge.plus', inventory_2_outlined: 'shippingbox', qr_code_scanner_rounded: 'qrcode.viewfinder', list_alt_outlined: 'list.bullet.rectangle', add_task_outlined: 'checklist' };
/** @v2 _AdminCreateHubOverlay and _AppPrimaryNavigationButton */
export function AdminCreateHubHost(props: AdminCreateHubNativeProps) {
  const { colors } = useBaseTheme();
  return <AdminCreateHubFloating {...props} render={{
    icon: (name, color) => <BaseHost matchContents><Image systemName={name === 'add' ? 'plus' : 'xmark'} size={24} color={color} /></BaseHost>,
    toggle: (label, onPress, children, id) => <BaseHost style={{ width: '100%', height: '100%' }}><Button onPress={onPress} modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity, maxHeight: Infinity }), accessibilityLabel(label), accessibilityIdentifier(id)]}>
      <RNHostView matchContents><View>{children}</View></RNHostView></Button></BaseHost>,
    action: (action, onPress) => <BaseHost matchContents><Button onPress={onPress} modifiers={[buttonStyle('plain'), disabled(!action.enabled), accessibilityLabel(action.label), accessibilityIdentifier(action.id)]}>
      <HStack spacing={10} modifiers={[padding({ horizontal: 14 }), frame({ minWidth: 56 }), frame({ height: 56 }), background(action.enabled ? colors.primaryContainer : colors.surfaceContainerHigh), cornerRadius(28)]}>
        <Image systemName={action.icon?.ios ?? icons[action.materialIcon!]} size={24} color={action.enabled ? colors.onPrimaryContainer : colors.onSurfaceVariant} />
        <Text modifiers={[font({ size: 16, weight: 'semibold' }), lineLimit(1), foregroundStyle(action.enabled ? colors.onPrimaryContainer : colors.onSurfaceVariant)]}>{action.label}</Text>
      </HStack>
    </Button></BaseHost>,
  }} />;
}
