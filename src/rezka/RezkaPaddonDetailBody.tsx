import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RezkaPaddonDetailHeader } from './RezkaPaddonDetailHeader';
import { RezkaPaddonWipSection } from './RezkaPaddonWipSection';
import { isRezkaPaddonDetailBinding } from './rezkaPaddonDetailRead';
import type { RezkaPaddonDetailHeaderProps } from './rezkaPaddonDetailHeaderTypes';
import { useRezkaPaddonDetailAccess } from './useRezkaPaddonDetailAccess';

/** Unconnected passive body; the full detail screen and all actions remain held. */
export function RezkaPaddonDetailBody({ snapshot, binding, refreshing = false, onRefresh }: RezkaPaddonDetailHeaderProps &
  { refreshing?: boolean; onRefresh?: () => void }) {
  const insets = useSafeAreaInsets(), allowed = useRezkaPaddonDetailAccess(snapshot, binding);
  if (!allowed || !isRezkaPaddonDetailBinding(binding, snapshot)) return null;
  return <ScrollView automaticallyAdjustContentInsets={false} alwaysBounceVertical={!!onRefresh}
    refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={() => {
      if (isRezkaPaddonDetailBinding(binding, snapshot)) onRefresh();
    }} /> : undefined}
    contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: insets.bottom + 120 }}>
    <RezkaPaddonDetailHeader snapshot={snapshot} binding={binding} />
    <View style={{ height: 12 }} />
    <RezkaPaddonWipSection snapshot={snapshot} binding={binding} />
  </ScrollView>;
}
