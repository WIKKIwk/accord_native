import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { werkaSuccessPresentation, type WerkaSuccessContentProps } from './werkaSuccessPresentation';

/** Body only: caller owns the title, auth lifecycle, dock and safe navigation. */
export function WerkaSuccessContent(props: WerkaSuccessContentProps) {
  const colors = useMaterialColors(), view = werkaSuccessPresentation(props);
  return <View style={{ flex: 1, paddingTop: 140 }}>
    <WorkerQueueCard backgroundColor={colors.surfaceContainerLow} first last><View style={{ flex: 1, alignItems: 'center', paddingVertical: 22, gap: 12 }}>
      <SymbolView name={{ android: 'verified' }} size={44} tintColor={colors.onSecondaryContainer} />
      <Text style={{ color: colors.onSurface, fontSize: 24, textAlign: 'center' }}>{view.id}</Text>
      <Text style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>{view.subtitle}</Text>
    </View></WorkerQueueCard>
    <View style={{ paddingHorizontal: 12, paddingTop: 6 }}><WorkerSheetButton label={view.actionLabel} variant="filled"
      onPress={() => props.onReturn(view.target)} /></View>
  </View>;
}
