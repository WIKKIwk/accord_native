import { ListItem, Text } from '@expo/ui';
import { Background, Rectangle } from '@expo/ui/swift-ui';
import { accessibilityHidden, font, foregroundStyle, lineLimit, truncationMode, type ShapeStyle } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text as RNText, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { orderCardAppearance, type OrderCardTone } from '../workerOrderAppearance';

type Props = { headline: string; supportingText: string; position: number; tone: OrderCardTone;
  first?: boolean; last?: boolean; onPress: () => void };
export function AdminWorkMapSequenceRow({ headline, supportingText, position, tone, onPress }: Props) {
  const { mode, colors } = useBaseTheme(), appearance = orderCardAppearance(tone, colors.surfaceContainerLowest, mode === 'dark');
  const background: ShapeStyle = appearance.gradientColors ? { type: 'linearGradient', colors: appearance.gradientColors,
    startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } } : appearance.color ?? colors.surfaceContainerLowest;
  const leading = <View style={styles.leading}>
    <View accessible={false} style={[styles.cover, { backgroundColor: colors.secondaryContainer }]}>
      <SymbolView name={{ ios: 'function' }} size={22} tintColor={colors.onSecondaryContainer} accessibilityElementsHidden />
    </View>
    <View style={[styles.badge, { backgroundColor: colors.primaryContainer }]}><RNText style={[styles.badgeText, { color: colors.onPrimaryContainer }]}>{position}</RNText></View>
  </View>;
  const secondary = appearance.secondary ?? colors.onSurfaceVariant ?? colors.onSurface;
  return <Background><ListItem testID="admin-sequence-order-row" onPress={onPress} leading={leading}
    supportingText={supportingText ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(secondary), lineLimit(1), truncationMode('tail')]}>{supportingText}</Text> : undefined}>
    <Text modifiers={[font({ textStyle: 'body', weight: 'bold' }), foregroundStyle(appearance.text ?? colors.onSurface), lineLimit(1), truncationMode('tail')]}>{headline}</Text>
  </ListItem><Background.Content><Rectangle modifiers={[foregroundStyle(background), accessibilityHidden(true)]} /></Background.Content></Background>;
}
const styles = StyleSheet.create({ leading: { flexDirection: 'row', alignItems: 'center' },
  cover: { width: 68, height: 48, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 30, height: 30, borderRadius: 15, marginHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '800' } });
