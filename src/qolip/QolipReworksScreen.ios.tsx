import { Button, Host, HStack, ProgressView, Section, Spacer, Text, Toggle, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, disabled, frame, labelStyle, labelsHidden } from '@expo/ui/swift-ui/modifiers';
import { Alert, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeSheet } from '../nativeSheet';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { extensionText, localizedGetter, localizedMethod, productionText } from '../shared/localization';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { QolipMileageSheet } from './QolipMileageSheet';
import { qolipErrorMessage } from './qolipErrorMessage';
import { qolipReworkDate } from './qolipMileageFormatting';
import type { QolipReworkEntry } from './qolipReworkApi';
import type { QolipReworksScreenProps } from './qolipReworksScreenProps';
import { useQolipNotice } from './useQolipNotice';
import { useQolipReworks } from './useQolipReworks';
import { useQolipText } from './useQolipText';

type Texts = (key: string, values?: Record<string, unknown>) => string;
function ReworkRow({ entry, selected, returned, saving, text, locale, toggle, mileage }: { entry: QolipReworkEntry;
  selected: boolean; returned: boolean; saving: boolean; text: Texts; locale: string; toggle: () => void; mileage: () => void }) {
  const lines = [entry.color ? localizedMethod('qolipColorName', locale, { raw: entry.color }) : '',
    `${text('sent_at')}: ${qolipReworkDate(entry.sent_at)}`,
    entry.returned_at === null ? '' : `${text('returned_at')}: ${qolipReworkDate(entry.returned_at)}`].filter(Boolean).join('\n');
  return <HStack spacing={8}>
    {!returned && <Toggle isOn={selected} onIsOnChange={toggle} modifiers={[disabled(saving), labelsHidden(), accessibilityLabel(entry.qolip_code)]} />}
    <Button onPress={returned ? mileage : toggle} modifiers={[buttonStyle('plain'), disabled(saving), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <VStack alignment="leading"><Text>{entry.qolip_code}</Text><Text>{lines}</Text></VStack>
    </Button>
    <Button label={text('mileage')} systemImage="speedometer" onPress={mileage}
      modifiers={[labelStyle('iconOnly'), accessibilityLabel(text('mileage'))]} />
  </HStack>;
}

// Reworks is not routed until the real request-ID source and role navigation are available.
export function QolipReworksScreen({ session, nextRequestId, onMenu, onProfile, dock }: QolipReworksScreenProps) {
  const { locale } = useQolipText(), state = useQolipReworks(session, nextRequestId), sheet = useNativeSheet(), notice = useQolipNotice();
  const insets = useSafeAreaInsets(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const t: Texts = (key, values = {}) => extensionText('qolipReworkText', key, locale, values);
  const openMileage = (code: string) => sheet.open(<QolipMileageSheet session={session} code={code} />, { dismissible: true });
  const returnSelected = () => {
    const prepared = state.controller.prepareReturn();
    if (!prepared) return;
    if (prepared.kind === 'session_changed') { notice.show(t('session_changed')); return; }
    Alert.alert(t('return'), t('return_confirm', { count: prepared.ids.length }), [
      { text: productionText('qolip.action.cancel', locale), style: 'cancel' },
      { text: t('return'), onPress: () => { void state.controller.confirmReturn(prepared).then(result => {
        if (result?.kind === 'session_changed') notice.show(t('session_changed'));
        else if (result?.kind === 'returned') notice.show(t('returned', { count: result.count }));
        else if (result?.kind === 'failed') notice.show(qolipErrorMessage(result.error, locale, t('failed')));
      }); } },
    ]);
  };
  return <View style={{ flex: 1, paddingTop: insets.top }}>
    <OrdersHeader search={state.query} searchPlaceholder={t('search')} onSearchChange={value => state.controller.setQuery(value)}
      onMenu={onMenu} onProfile={onProfile} />
    <Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={10}><Text>{t('title')}</Text><HStack spacing={8}>
      <Button label={t('open')} onPress={() => state.controller.setReturned(false)}
        modifiers={[disabled(state.saving), buttonStyle(state.returned ? 'bordered' : 'borderedProminent')]} />
      <Button label={t('history')} onPress={() => state.controller.setReturned(true)}
        modifiers={[disabled(state.saving), buttonStyle(state.returned ? 'borderedProminent' : 'bordered')]} />
    </HStack></VStack></Host>
    {state.loading ? <View style={{ flex: 1, justifyContent: 'center' }}><Host matchContents><ProgressView /></Host></View>
      : state.error ? <View style={{ flex: 1, justifyContent: 'center' }}><Host matchContents><VStack>
        <Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
        <Button label={localizedGetter('retry', locale)} onPress={() => { void state.controller.load().catch(() => {}); }} />
      </VStack></Host></View> : <Host style={{ flex: 1 }}><OrdersList active headerOffset={headerOffset} headerHeight={headerHeight}
        topInset={0} onRefresh={async () => { await state.controller.load().catch(() => {}); }}>
        {!state.groups.length && <Section><Text>{t(state.returned ? 'history_empty' : 'empty')}</Text></Section>}
        {state.groups.map(group => <Section key={group.key}>
          <HStack>{!state.returned && <Toggle isOn={group.selected} onIsOnChange={checked => state.controller.selectGroup(group.entries, checked)}
            modifiers={[disabled(state.saving), labelsHidden(), accessibilityLabel(group.names.join(', ') || group.key)]} />}
            <VStack alignment="leading"><Text>{group.names.length ? group.names.join(', ') : group.key}</Text>
              <Text>{`${extensionText('qolipSharedSetText', 'id', locale)}: ${group.key}`}</Text></VStack><Spacer />
          </HStack>
          {group.entries.map((entry, index) => <ReworkRow key={`${entry.id}:${index}`} entry={entry}
            selected={state.selected.has(entry.id)} returned={state.returned} saving={state.saving} text={t} locale={locale}
            toggle={() => state.controller.toggle(entry.id)} mileage={() => openMileage(entry.qolip_code)} />)}
        </Section>)}
      </OrdersList></Host>}
    {!state.returned && state.selected.size > 0 && <Host matchContents={{ vertical: true }}>
      {state.saving ? <HStack><ProgressView /><Text>{t('return_selected', { count: state.selected.size })}</Text></HStack>
        : <Button label={t('return_selected', { count: state.selected.size })} onPress={returnSelected} />}
    </Host>}
    {dock}<PreparationNotice message={notice.message} />
  </View>;
}
