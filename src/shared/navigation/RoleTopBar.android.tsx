import { Box, Row, Surface } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import type { ReactNode } from 'react';
import { useBaseTheme } from '../../components/useBaseTheme';

export function RoleTopBar({ title, leading, actions, compact = false }: {
  title: ReactNode; leading?: ReactNode; actions?: ReactNode; compact?: boolean;
}) {
  const { colors } = useBaseTheme();
  return <Surface color={compact ? colors.surfaceContainerHigh : 'transparent'} contentColor={colors.onSurface}
    tonalElevation={0} modifiers={[fillMaxWidth()]}>
    <Row verticalAlignment="center" modifiers={[
      fillMaxWidth(),
      compact ? height(60) : defaultMinSize({ minHeight: 70 }),
      ...(compact ? [] : [padding(10, 6, 10, 6)]),
    ]}>
      {leading ? <Box contentAlignment="center" modifiers={[width(compact ? 56 : 48)]}>{leading}</Box> : null}
      <Box modifiers={[weight(1), padding(leading ? (compact ? 0 : 6) : (compact ? 20 : 0), 0, 4, 0)]}>{title}</Box>
      {actions ? <Row verticalAlignment="center">{actions}</Row> : null}
    </Row>
  </Surface>;
}
