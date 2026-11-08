import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, ScrollView, Text } from 'react-native';
import { PreparationRow } from '../preparation/PreparationUI.android';
import { werkaArchiveBatchPresentation, type WerkaArchiveBatchContentProps } from './werkaArchiveBatchPresentation';

/** Read-only panel; picker, send, routes and guarded state are intentionally not connected. */
export function WerkaArchiveBatchContent(props: WerkaArchiveBatchContentProps) {
  const view = werkaArchiveBatchPresentation(props), colors = useMaterialColors();
  return <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 112, gap: 2 }}>
    <PreparationRow title={view.title} subtitle={view.subtitle} trailing={props.state === 'loading' ? <ActivityIndicator />
      : <SymbolView name={{ android: props.state === 'missing' ? 'error_outline' : 'check_circle' }} size={20} tintColor={colors.onSurface} />} />
    {view.rows.map((row, index) => <PreparationRow key={`${row.label}:${index}`} title={row.label}
      trailing={<Text style={{ color: colors.onSurface }}>{row.value}</Text>} />)}
  </ScrollView>;
}
