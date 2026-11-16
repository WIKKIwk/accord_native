import { Box, LoadingIndicator } from '@expo/ui/jetpack-compose';
import { graphicsLayer, semantics, size as nativeSize } from '@expo/ui/jetpack-compose/modifiers';
import { useBaseTheme } from '../components/useBaseTheme';

/** @v2 AppLoadingIndicator */
export function AdminLoadingIndicator({ size = 64, glyphSize = 38 }: { size?: number; glyphSize?: number }) {
  const { colors } = useBaseTheme(), scale = glyphSize / 38;
  return <Box contentAlignment="center" modifiers={[nativeSize(size, size)]}>
    <LoadingIndicator color={colors.primary} modifiers={[nativeSize(48, 48), graphicsLayer({ scaleX: scale, scaleY: scale }), semantics({ contentDescription: 'Loading' })]} />
  </Box>;
}
