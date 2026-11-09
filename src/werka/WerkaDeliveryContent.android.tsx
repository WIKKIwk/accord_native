import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { ScrollView, Text } from 'react-native';
import { PreparationRow } from '../preparation/PreparationUI.android';
import { werkaDeliveryPresentation, type WerkaDeliveryContentProps } from './werkaDeliveryPresentation';

/** Read-only body. The shared notification discussion route remains under the account-safety hold. */
export function WerkaDeliveryContent(props: WerkaDeliveryContentProps) {
  const view = werkaDeliveryPresentation(props), colors = useMaterialColors();
  return <ScrollView contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 14, paddingBottom: 136, gap: 2 }}>
    <PreparationRow title={view.supplier} trailing={<Text style={{ color: colors.onSurfaceVariant }}>{view.status}</Text>} />
    {view.rows.map((row, index) => <PreparationRow key={`${row.label}:${index}`} title={row.label}
      trailing={<Text style={{ color: colors.onSurface }}>{row.value}</Text>} />)}
    <PreparationRow title={view.noteTitle} subtitle={view.note} />
  </ScrollView>;
}
