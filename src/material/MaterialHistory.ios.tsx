import { Button, Host, HStack, Image, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, lineLimit } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { PlatformColor, Text as NativeText, View } from 'react-native';
import { registerSessionResetHook, sessionWitnessVersion, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { PreparationList } from '../preparation/PreparationUI';
import type { AdminApparatus } from '../apparatusApi';
import type { AdminRawMaterialEvent } from './materialHistoryApi';
import { materialHistoryDetails, materialHistorySubtitle, materialHistoryTime, materialHistoryTitle } from './materialHistoryPresentation';
import { materialHistoryMessageSymbols, materialHistorySymbol } from './materialHistorySymbols';
import { useMaterialContext } from './MaterialContext';
import { useMaterialHistory } from './useMaterialHistory';
import { materialHistoryCurrent } from './materialHistoryAccess';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';

// @v2 _MaterialHistoryDetailsSheet
function MaterialHistoryDetails({ event, catalog, session, witness }: { event: AdminRawMaterialEvent; catalog: AdminApparatus[]; session: Session; witness: SessionWitness }) {
  useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  if (!materialHistoryCurrent(session, witness)) return null;
  const details = materialHistoryDetails(event, catalog);
  return <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <VStack alignment="leading" spacing={18} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <HStack alignment="top" spacing={12}>
        <Image systemName={materialHistorySymbol(event.event_type).ios} size={24} color={PlatformColor('secondaryLabel')} />
        <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{materialHistoryTitle(event)}</Text>
          <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{materialHistorySubtitle(event, catalog)}</Text>
        </VStack>
      </HStack>
      <VStack alignment="leading" spacing={7} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        {details.map((detail, index) => <HStack key={`${detail.label}:${index}`} alignment="top" spacing={0}>
          <Text modifiers={[font({ textStyle: 'caption' }), secondary, frame({ width: 104, alignment: 'leading' })]}>{detail.label}</Text>
          <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{detail.value}</Text>
        </HStack>)}
      </VStack>
    </VStack>
  </Host></View>;
}

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

// @v2 MaterialTaminotchiHistoryScreen
export function MaterialHistory() {
  const { session, witness } = useMaterialContext(), history = useMaterialHistory(session, witness), sheet = useNativeSheet();
  useEffect(() => {
    const check = () => { if (!materialHistoryCurrent(session, witness)) sheet.close(); };
    const unsubscribe = subscribeSessionWitness(check), unregister = registerSessionResetHook(async () => { sheet.close(); });
    check(); return () => { unregister(); unsubscribe(); sheet.close(); };
  }, [session, witness, sheet]);
  if (!history.allowed) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <NativeText>{localizedGetter('accessDenied', localeController.locale)}</NativeText></View>;
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: 'Harakatlar tarixi' }} />
    <PreparationList refresh={history.refresh}>
      {history.loading ? <ProgressView /> : history.error ? <Section><Button onPress={history.reload}>
        <HStack spacing={12}><Image systemName={materialHistoryMessageSymbols.error.ios} size={22} modifiers={[secondary]} />
          <VStack alignment="leading" modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text>Tarix yuklanmadi</Text><Text>{history.error}</Text></VStack></HStack>
      </Button></Section> : !history.events.length ? <Section><HStack spacing={12}>
        <Image systemName={materialHistoryMessageSymbols.empty.ios} size={22} modifiers={[secondary]} /><Text>Harakatlar hali yo‘q</Text>
      </HStack></Section> :
        <Section>{history.events.slice(0, 100).map((event, index) => <Button key={`${event.event_id}:${index}`}
          onPress={() => { if (materialHistoryCurrent(session, witness)) sheet.open(<MaterialHistoryDetails event={event} catalog={history.apparatus} session={session} witness={witness} />, { dismissible: true, compact: true, fitContent: true }); }}>
          <HStack alignment="top" spacing={12}><Image systemName={materialHistorySymbol(event.event_type).ios} size={22} color={PlatformColor('systemBlue')} />
            <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
              <Text modifiers={[font({ textStyle: 'subheadline', weight: 'bold' }), lineLimit(1)]}>{materialHistoryTitle(event)}</Text>
              <Text modifiers={[font({ textStyle: 'caption' }), secondary, lineLimit(2)]}>{materialHistorySubtitle(event, history.apparatus)}</Text>
            </VStack><VStack alignment="trailing" spacing={3}><Text modifiers={[font({ textStyle: 'caption2' }), secondary]}>
              {materialHistoryTime(event.occurred_at_unix)}</Text><Image systemName="chevron.right" size={16} modifiers={[secondary]} /></VStack>
          </HStack>
        </Button>)}</Section>}
    </PreparationList>
  </View>;
}
