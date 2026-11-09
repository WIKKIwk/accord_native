import { Button, Host, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { multilineTextAlignment } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { localizedGetter, productionText } from '../shared/localization';
import { RezkaPaddonDetailBody } from './RezkaPaddonDetailBody';
import type { RezkaPaddonDetailReadOnlyProps } from './rezkaPaddonDetailReadOnlyTypes';
import { useRezkaPaddonDetail } from './useRezkaPaddonDetail';
import { useRezkaLocale } from './useRezkaShell';

/** Unconnected detail content; navigation and every Paddon action remain held. */
export function RezkaPaddonDetailReadOnly({ snapshot, apparatusId, code }: RezkaPaddonDetailReadOnlyProps) {
  const { state, controller, isCurrent } = useRezkaPaddonDetail(snapshot, apparatusId, code), locale = useRezkaLocale();
  if (!isCurrent() || state.phase === 'invalid') return null;
  const refresh = () => { if (isCurrent()) void controller.refresh(); };
  if (state.phase === 'loading') return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Host matchContents><ProgressView /></Host></View>;
  if (state.phase === 'error' || !state.binding) return <View style={{ flex: 1, alignItems: 'center', padding: 24 }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack spacing={16}>
      <Text modifiers={[multilineTextAlignment('center')]}>{productionText('worker.paddon.load_failed', locale)}</Text>
      <Button label={localizedGetter('retry', locale)} onPress={refresh} />
    </VStack></Host></View>;
  return <RezkaPaddonDetailBody snapshot={snapshot} binding={state.binding} refreshing={state.refreshing} onRefresh={refresh} />;
}
