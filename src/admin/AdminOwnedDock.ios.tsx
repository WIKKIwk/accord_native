import { Button, HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityIdentifier, background, buttonStyle, clipShape, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminOwnedDock, type AdminOwnedDockProps } from './useAdminOwnedDock';
import { useAdminShellLayout } from './useAdminShellLayout';

/** Pushed Users pages retain source selection/history while the root Home/Activity native tab bar is hidden. */
export function AdminOwnedDock(props: AdminOwnedDockProps) {
  const model = useAdminOwnedDock(props), { colors } = useBaseTheme(), layout = useAdminShellLayout(true);
  if (layout.dockBottomInset === null) return null;
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }} ignoreSafeArea="keyboard"><HStack spacing={0} modifiers={[frame({ maxWidth: Infinity, minHeight: 60 }),
    padding({ bottom: layout.dockBottomInset }), background(colors.surfaceContainerHigh), accessibilityAddTraits(['isTabBar'])]}>
    {model.destinations.map(item => <Button key={item.id} onPress={() => model.select(item.id)} modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity, minHeight: 60 }),
      accessibilityIdentifier(item.id), ...(model.active === item.id ? [accessibilityAddTraits(['isSelected'])] : [])]}>
      <VStack spacing={4} modifiers={[frame({ maxWidth: Infinity }), foregroundStyle(model.active === item.id ? colors.primary : colors.onSurfaceVariant)]}>
        <ZStack alignment="topTrailing">
          <Image systemName={item.tab === 'home' ? model.active === item.id ? 'house.fill' : 'house' : item.tab === 'user' ? model.active === item.id ? 'person.fill' : 'person'
            : item.tab === 'chat' ? model.active === item.id ? 'bubble.left.fill' : 'bubble.left' : 'clock.arrow.circlepath'} size={23} />
          {item.tab === 'chat' && model.showChatBadge ? <Spacer modifiers={[frame({ width: 7, height: 7 }), background(colors.error), clipShape('circle')]} /> : null}
        </ZStack>
        <Text modifiers={[font({ textStyle: 'caption2' })]}>{item.label}</Text>
      </VStack>
    </Button>)}
  </HStack></BaseHost>;
}
