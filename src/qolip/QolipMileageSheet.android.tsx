import { Column, Host, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, ScrollView, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { extensionText, localizedGetter } from '../shared/localization';
import { qolipMileageMeter, qolipReworkDate } from './qolipMileageFormatting';
import type { QolipMileageSheetProps } from './qolipMileageSheetProps';
import { useQolipMileage } from './useQolipMileage';
import { useQolipText } from './useQolipText';

// The mileage sheet is not wired until a caller can open it from the reworks screen.
export function QolipMileageSheet({ session, code }: QolipMileageSheetProps) {
  const { locale } = useQolipText(), state = useQolipMileage(session, code), { height } = useWindowDimensions(), colors = useMaterialColors();
  const t = (key: string, values: Record<string, unknown> = {}) => extensionText('qolipReworkText', key, locale, values);
  const current = state.mileage?.tracking_enabled && state.mileage.current_meter !== null
    ? t('current', { meter: qolipMileageMeter(state.mileage.current_meter) }) : t('not_started');
  return <View style={{ height: height * 0.65, paddingHorizontal: 20, paddingBottom: 20 }}>
    <Host matchContents={{ vertical: true }}><Text style={{ typography: 'titleLarge' }}>{t('mileage')}</Text></Host>
    <NativeText selectable style={{ color: colors.onSurface, fontSize: 16, marginTop: 8, marginBottom: 16 }}>{code}</NativeText>
    {state.loading ? <ActivityIndicator /> : state.error ? <Host matchContents={{ vertical: true }}><Column>
      <Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
      <TextButton modifiers={[testID('qolip-mileage-retry')]} onClick={() => { void state.controller.load().catch(() => {}); }}>
        <Text>{localizedGetter('retry', locale)}</Text>
      </TextButton>
    </Column></Host> : state.mileage ? <ScrollView>
      <Host matchContents={{ vertical: true }}><Text style={{ typography: 'titleMedium' }}>{current}</Text></Host>
      {[...state.mileage.cycles].reverse().map((cycle, index) => <View key={`${cycle.id}:${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
        <SymbolView name={{ android: cycle.ended_at === null ? 'speed' : 'history' }} size={24} tintColor={colors.onSurfaceVariant} />
        <Host matchContents={{ vertical: true }} style={{ flex: 1 }}><Column>
          <Text>{t('cycle', { meter: qolipMileageMeter(cycle.meter) })}</Text>
          <Text>{`${qolipReworkDate(cycle.started_at)} → ${cycle.ended_at === null ? t('active_cycle') : qolipReworkDate(cycle.ended_at)}`}</Text>
        </Column></Host>
      </View>)}
    </ScrollView> : null}
  </View>;
}
