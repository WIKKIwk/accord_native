import { Box, Row, Surface } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import type { ReactNode } from 'react';
import { useBaseTheme } from '../../components/useBaseTheme';
import { roleHeaderMetrics as metrics } from './roleNavigationMetrics';

export function RoleTopBar({ title, leading, actions }: {
  title: ReactNode; leading?: ReactNode; actions?: ReactNode;
}) {
  const { colors } = useBaseTheme();
  return <Surface color="transparent" contentColor={colors.onSurface}
    tonalElevation={0} modifiers={[fillMaxWidth()]}>
    <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: metrics.gap }} modifiers={[
      fillMaxWidth(),
      defaultMinSize({ minHeight: metrics.minHeight }),
      padding(metrics.horizontalPadding, metrics.verticalPadding, metrics.horizontalPadding, metrics.verticalPadding),
    ]}>
      {leading}
      <Box modifiers={[weight(1)]}>{title}</Box>
      {actions ? <Row verticalAlignment="center">{actions}</Row> : null}
    </Row>
  </Surface>;
}
