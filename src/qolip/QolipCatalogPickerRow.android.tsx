import { Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { useWorkerColors } from '../components/useWorkerColors';
export function QolipCatalogPickerRow({ title, subtitle, onPress, first, last, set = false, disabled }: {
  title: string; subtitle: string; onPress(): void; first?: boolean; last?: boolean; set?: boolean; disabled?: boolean;
}) {
  const colors = useWorkerColors();
  return <WorkerQueueCard first={first} last={last} backgroundColor={colors.surface} onPress={onPress} disabled={disabled}>
    {set && <SymbolView name={{ android: 'layers' }} size={24} tintColor={colors.icon} />}
    <View style={{ flex: 1, gap: 4, paddingVertical: 8, paddingStart: set ? 12 : 0 }}><Text numberOfLines={2} style={{ color: colors.text, fontSize: 16 }}>{title}</Text>
      {!!subtitle && <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 14 }}>{subtitle}</Text>}</View>
  </WorkerQueueCard>;
}
