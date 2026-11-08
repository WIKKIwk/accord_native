import { Button, Host, HStack, Image, List, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { textSelection } from '@expo/ui/swift-ui/modifiers';
import { View, useWindowDimensions } from 'react-native';
import { extensionText, localizedGetter } from '../shared/localization';
import { qolipMileageMeter, qolipReworkDate } from './qolipMileageFormatting';
import type { QolipMileageSheetProps } from './qolipMileageSheetProps';
import { useQolipMileage } from './useQolipMileage';
import { useQolipText } from './useQolipText';

// The mileage sheet is not wired until a caller can open it from the reworks screen.
export function QolipMileageSheet({ session, code }: QolipMileageSheetProps) {
  const { locale } = useQolipText(), state = useQolipMileage(session, code), { height } = useWindowDimensions();
  const t = (key: string, values: Record<string, unknown> = {}) => extensionText('qolipReworkText', key, locale, values);
  const current = state.mileage?.tracking_enabled && state.mileage.current_meter !== null
    ? t('current', { meter: qolipMileageMeter(state.mileage.current_meter) }) : t('not_started');
  return <View style={{ height: height * 0.65, paddingHorizontal: 20, paddingBottom: 20 }}><Host style={{ flex: 1 }}>
    <VStack alignment="leading" spacing={12}>
      <Text>{t('mileage')}</Text><Text modifiers={[textSelection(true)]}>{code}</Text>
      {state.loading ? <ProgressView /> : state.error ? <VStack spacing={12}>
        <Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
        <Button label={localizedGetter('retry', locale)} onPress={() => { void state.controller.load().catch(() => {}); }} />
      </VStack> : state.mileage ? <List>
        <Text>{current}</Text>
        {[...state.mileage.cycles].reverse().map((cycle, index) => <HStack key={`${cycle.id}:${index}`} spacing={10}>
          <Image systemName={cycle.ended_at === null ? 'speedometer' : 'clock.arrow.circlepath'} />
          <VStack alignment="leading"><Text>{t('cycle', { meter: qolipMileageMeter(cycle.meter) })}</Text>
            <Text>{`${qolipReworkDate(cycle.started_at)} → ${cycle.ended_at === null ? t('active_cycle') : qolipReworkDate(cycle.ended_at)}`}</Text>
          </VStack>
        </HStack>)}
      </List> : null}
    </VStack>
  </Host></View>;
}
