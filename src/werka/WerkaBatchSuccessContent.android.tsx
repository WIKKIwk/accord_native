import { Button, Host } from '@expo/ui';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { werkaBatchSuccessPresentation, type WerkaBatchSuccessContentProps } from './werkaBatchOutcomeModel';

/** Displays supplied counts only. Return navigation remains closed. */
export function WerkaBatchSuccessContent(props: WerkaBatchSuccessContentProps) {
  const colors = useMaterialColors(), view = werkaBatchSuccessPresentation(props);
  return <View style={{ flex: 1, paddingTop: 140 }}>
    <WorkerQueueCard backgroundColor={colors.surfaceContainerLow} first last><View style={{ flex: 1, alignItems: 'center', paddingVertical: 22, gap: 12 }}>
      <SymbolView name={{ android: 'verified' }} size={44} tintColor={colors.onSecondaryContainer} />
      <Text style={{ color: colors.onSurface, fontSize: 24, textAlign: 'center' }}>{view.created}</Text>
      <Text style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>{view.detail}</Text>
    </View></WorkerQueueCard>
    <View style={{ paddingHorizontal: 12, paddingTop: 6 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Button label={view.returnLabel} disabled />
    </Host></View>
  </View>;
}
