import { padding } from '@expo/ui/jetpack-compose/modifiers';
import { useMemo } from 'react';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { AdminText } from './AdminTypography.android';
import type { AdminWorkMapControlsProps } from './adminWorkMapControlsTypes';

export function AdminWorkMapApparatusFilter({ catalog, selected, apparatusLabel, unselectedLabel, countText, onApparatus }: AdminWorkMapControlsProps) {
  const { colors } = useBaseTheme();
  const options = useMemo(() => catalog.map(item => ({ value: item.id, label: item.name.trim() })), [catalog]);
  return <View style={{ paddingTop: 4 }}>
    <DropdownFilter label={apparatusLabel} selectedLabel={selected?.name.trim() || unselectedLabel}
      options={options} enabled={options.length > 0} backgroundColor={colors.surface} onChange={onApparatus} />
    {!!countText && <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <AdminText color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[padding(12, 8, 12, 10)]}>{countText}</AdminText>
    </BaseHost>}
  </View>;
}
