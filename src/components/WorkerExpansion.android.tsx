import { Icon, Row, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, rotate, weight } from '@expo/ui/jetpack-compose/modifiers';
import { BaseHost } from './BaseHost';
import { useBaseTheme } from './useBaseTheme';

type Props = { title: string; count: string; expanded: boolean; onPress?: () => void; systemColors?: boolean };

export function WorkerExpansion({ title, count, expanded, onPress, systemColors = false }: Props) {
  const { colors: configuredColors } = useBaseTheme();
  const systemPalette = useMaterialColors({});
  const colors = systemColors ? systemPalette : configuredColors;
  const secondaryText = colors.onSurfaceVariant ?? colors.onSurface;
  const label = <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
    <Text color={colors.onSurface} style={{ typography: 'bodyLarge', fontWeight: '500' }} modifiers={[weight(1)]}>{title}</Text>
    {!!count && <Text color={secondaryText} style={{ typography: 'bodyMedium' }} maxLines={1}>{count}</Text>}
    {onPress ? <Icon source={require('../../assets/icons/gscale/expand_more.xml')} size={20} tint={secondaryText}
      modifiers={[rotate(expanded ? 180 : 0)]} /> : null}
  </Row>;
  return <BaseHost dynamicColors={systemColors} matchContents={{ vertical: true }} style={{ width: '100%' }}>
    {onPress ? <TextButton onClick={onPress} contentPadding={{ start: 0, end: 0, top: 10, bottom: 10 }} modifiers={[fillMaxWidth()]}>{label}</TextButton> : label}
  </BaseHost>;
}
