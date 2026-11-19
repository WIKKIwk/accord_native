import { Button, HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityIdentifier, background, buttonStyle, clipShape, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'expo-symbols';
import { BaseHost } from '../../components/BaseHost.ios';
import { useBaseTheme } from '../../components/useBaseTheme';

type Item = { id: string; label: string; icon: SFSymbol; selectedIcon?: SFSymbol; showBadge?: boolean };
const tabHeight = 60;

/** SwiftUI tab controls for screens whose navigation is owned by a stack. */
export function RoleBottomBar({ items, active, onSelect, bottomInset }: {
  items: readonly Item[]; active: string; onSelect: (id: string) => void; bottomInset: number;
}) {
  const { colors } = useBaseTheme();
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }} ignoreSafeArea="keyboard">
    <HStack spacing={0} modifiers={[frame({ maxWidth: Infinity, minHeight: tabHeight }), padding({ bottom: bottomInset }),
      background(colors.surface), accessibilityAddTraits(['isTabBar'])]}>
      {items.map(item => {
        const selected = active === item.id;
        return <Button key={item.id} onPress={() => onSelect(item.id)} modifiers={[
          buttonStyle('plain'), frame({ maxWidth: Infinity, minHeight: tabHeight }), accessibilityIdentifier(item.id),
          ...(selected ? [accessibilityAddTraits(['isSelected'])] : []),
        ]}>
          <VStack spacing={4} modifiers={[frame({ maxWidth: Infinity }), foregroundStyle(selected ? colors.primary : colors.onSurfaceVariant)]}>
            <ZStack alignment="topTrailing">
              <Image systemName={selected ? item.selectedIcon ?? item.icon : item.icon} size={23} />
              {item.showBadge ? <Spacer modifiers={[frame({ width: 7, height: 7 }), background(colors.error), clipShape('circle')]} /> : null}
            </ZStack>
            <Text modifiers={[font({ textStyle: 'caption2' })]}>{item.label}</Text>
          </VStack>
        </Button>;
      })}
    </HStack>
  </BaseHost>;
}
