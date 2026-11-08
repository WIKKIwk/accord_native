import { Button, Host, HStack, Image, List, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, lineLimit } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { PlatformColor, View } from 'react-native';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { PreparationList } from '../preparation/PreparationUI';
import type { AdminApparatus } from '../apparatusApi';
import type { AdminRawMaterialEvent } from './materialHistoryApi';
import { materialHistoryDetails, materialHistorySubtitle, materialHistoryTime, materialHistoryTitle } from './materialHistoryPresentation';
import { materialHistorySymbol } from './materialHistorySymbols';
import { useMaterialContext } from './MaterialContext';
import { useMaterialHistory } from './useMaterialHistory';

// @v2 _MaterialHistoryDetailsSheet
function MaterialHistoryDetails({ event, catalog, session }: { event: AdminRawMaterialEvent; catalog: AdminApparatus[]; session: Session }) {
  const [valid, setValid] = useState(true);
  useEffect(() => registerSessionResetHook(async () => { setValid(false); }), []);
  const details = materialHistoryDetails(event, catalog);
  if (!valid || !activeSessionToken(session)) return null;
  return <Host style={{ flex: 1, minHeight: 360 }}><VStack spacing={10}>
    <Text>{materialHistoryTitle(event)}</Text><Text>{materialHistorySubtitle(event, catalog)}</Text>
    <List><Section>{details.map((detail, index) => <VStack key={`${detail.label}:${index}`} alignment="leading">
      <Text>{detail.label}</Text><Text>{detail.value}</Text>
    </VStack>)}</Section></List>
  </VStack></Host>;
}

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

// @v2 MaterialTaminotchiHistoryScreen
export function MaterialHistory() {
  const { session } = useMaterialContext(), history = useMaterialHistory(session), sheet = useNativeSheet();
  useEffect(() => registerSessionResetHook(async () => { sheet.close(); }), [sheet]);
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: 'Harakatlar tarixi' }} />
    <PreparationList refresh={history.refresh}>
      {history.loading ? <ProgressView /> : history.error ? <Section><Button onPress={history.reload}>
        <VStack alignment="leading"><Text>Tarix yuklanmadi</Text><Text>{history.error}</Text></VStack>
      </Button></Section> : !history.events.length ? <Section><Text>Harakatlar hali yo‘q</Text></Section> :
        <Section>{history.events.slice(0, 100).map((event, index) => <Button key={`${event.event_id}:${index}`}
          onPress={() => sheet.open(<MaterialHistoryDetails event={event} catalog={history.apparatus} session={session} />, { dismissible: true })}>
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
