import { Button, Column, Host, Text } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, View } from 'react-native';
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
  if (state.phase === 'loading') return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (state.phase === 'error' || !state.binding) return <View style={{ flex: 1, alignItems: 'center', padding: 24 }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }}>
      <Text style={{ typography: 'bodyLarge', textAlign: 'center' }}>{productionText('worker.paddon.load_failed', locale)}</Text>
      <Button onClick={refresh}><Text>{localizedGetter('retry', locale)}</Text></Button>
    </Column></Host></View>;
  return <RezkaPaddonDetailBody snapshot={snapshot} binding={state.binding} refreshing={state.refreshing} onRefresh={refresh} />;
}
