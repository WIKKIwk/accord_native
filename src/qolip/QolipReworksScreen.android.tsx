import { AlertDialog, Button, Checkbox, CircularProgressIndicator, Column, Host, SegmentedButton, SingleChoiceSegmentedButtonRow, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
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
import type { QolipReworksState } from './qolipReworksState';
import { useQolipNotice } from './useQolipNotice';
import { useQolipReworks } from './useQolipReworks';
import { useQolipText } from './useQolipText';

type Texts = (key: string, values?: Record<string, unknown>) => string;
type Prepared = Extract<ReturnType<QolipReworksState['prepareReturn']>, { kind: 'confirm' }>;
function ReworkRow({ entry, selected, returned, saving, text, locale, toggle, mileage, last }: { entry: QolipReworkEntry;
  selected: boolean; returned: boolean; saving: boolean; text: Texts; locale: string; toggle: () => void; mileage: () => void; last: boolean }) {
  const colors = useMaterialColors();
  const lines = [entry.color ? localizedMethod('qolipColorName', locale, { raw: entry.color }) : '',
    `${text('sent_at')}: ${qolipReworkDate(entry.sent_at)}`,
    entry.returned_at === null ? '' : `${text('returned_at')}: ${qolipReworkDate(entry.returned_at)}`].filter(Boolean).join('\n');
  return <WorkerQueueCard backgroundColor={colors.surface} last={last} onPress={saving ? undefined : returned ? mileage : toggle}>
    {!returned ? <Host matchContents={{ vertical: true }}><Checkbox value={selected} enabled={!saving}
      onCheckedChange={toggle} modifiers={[testID(`qolip-rework-select-${entry.qolip_code}`)]} /></Host>
      : <SymbolView name={{ android: 'check_circle' }} size={24} tintColor={colors.onSurfaceVariant} />}
    <View style={{ flex: 1, marginStart: 10 }}><NativeText style={{ color: colors.onSurface, fontSize: 16 }}>{entry.qolip_code}</NativeText>
      <NativeText style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>{lines}</NativeText></View>
    <Pressable accessibilityRole="button" accessibilityLabel={text('mileage')} onPress={mileage} hitSlop={8}>
      <SymbolView name={{ android: 'speed' }} size={24} tintColor={colors.onSurfaceVariant} />
    </Pressable>
  </WorkerQueueCard>;
}
function ReturnDialog({ count, text, locale, cancel, confirm }: { count: number; text: Texts; locale: string; cancel: () => void; confirm: () => void }) {
  const { width, height } = useWindowDimensions();
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={cancel}>
      <AlertDialog.Title><Text>{text('return')}</Text></AlertDialog.Title>
      <AlertDialog.Text><Text>{text('return_confirm', { count })}</Text></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton onClick={cancel}><Text>{productionText('qolip.action.cancel', locale)}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton onClick={confirm} modifiers={[testID('qolip-rework-return-confirm')]}><Text>{text('return')}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}
const passthrough = () => true;

// Reworks is not routed until the real request-ID source and role navigation are available.
export function QolipReworksScreen({ session, nextRequestId, onMenu, onProfile, dock }: QolipReworksScreenProps) {
  const { locale } = useQolipText(), state = useQolipReworks(session, nextRequestId), sheet = useNativeSheet(), notice = useQolipNotice();
  const [prepared, setPrepared] = useState<Prepared | null>(null), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const t: Texts = (key, values = {}) => extensionText('qolipReworkText', key, locale, values);
  const openMileage = (code: string) => sheet.open(<QolipMileageSheet session={session} code={code} />, { compact: true, fitContent: true, dismissible: true });
  const returnSelected = () => {
    const pending = state.controller.prepareReturn();
    if (!pending) return;
    if (pending.kind === 'session_changed') notice.show(t('session_changed')); else setPrepared(pending);
  };
  const confirm = () => {
    if (!prepared) return;
    const pending = prepared; setPrepared(null);
    void state.controller.confirmReturn(pending).then(result => {
      if (result?.kind === 'session_changed') notice.show(t('session_changed'));
      else if (result?.kind === 'returned') notice.show(t('returned', { count: result.count }));
      else if (result?.kind === 'failed') notice.show(qolipErrorMessage(result.error, locale, t('failed')));
    });
  };
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <OrdersHeader search={state.query} searchPlaceholder={t('search')} onSearchChange={value => state.controller.setQuery(value)}
      onMenu={onMenu} onProfile={onProfile} />
    <Host matchContents={{ vertical: true }}><Column>
      <Text style={{ typography: 'titleLarge' }}>{t('title')}</Text>
      <SingleChoiceSegmentedButtonRow>
        <SegmentedButton selected={!state.returned} enabled={!state.saving} onClick={() => state.controller.setReturned(false)}>
          <SegmentedButton.Label><Text>{t('open')}</Text></SegmentedButton.Label>
        </SegmentedButton>
        <SegmentedButton selected={state.returned} enabled={!state.saving} onClick={() => state.controller.setReturned(true)}>
          <SegmentedButton.Label><Text>{t('history')}</Text></SegmentedButton.Label>
        </SegmentedButton>
      </SingleChoiceSegmentedButtonRow>
    </Column></Host>
    {state.loading ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
      : state.error ? <View style={{ flex: 1, justifyContent: 'center' }}><Host matchContents={{ vertical: true }}><Column>
        <Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
        <TextButton onClick={() => { void state.controller.load().catch(() => {}); }}><Text>{localizedGetter('retry', locale)}</Text></TextButton>
      </Column></Host></View> : <OrdersList active passthrough={passthrough} headerOffset={headerOffset} headerHeight={headerHeight}
        topInset={0} onRefresh={async () => { await state.controller.load().catch(() => {}); }}>
        {!state.groups.length && <Host matchContents={{ vertical: true }}><Text>{t(state.returned ? 'history_empty' : 'empty')}</Text></Host>}
        {state.groups.map(group => <View key={group.key}>
          <WorkerQueueCard backgroundColor={colors.surface} first>
            {!state.returned ? <Host matchContents={{ vertical: true }}><Checkbox value={group.selected} enabled={!state.saving}
              onCheckedChange={checked => state.controller.selectGroup(group.entries, checked)} /></Host>
              : <SymbolView name={{ android: 'layers' }} size={24} tintColor={colors.onSurfaceVariant} />}
            <View style={{ flex: 1, marginStart: 10 }}><NativeText style={{ color: colors.onSurface, fontSize: 16 }}>
              {group.names.length ? group.names.join(', ') : group.key}</NativeText>
              <NativeText style={{ color: colors.onSurfaceVariant }}>{`${extensionText('qolipSharedSetText', 'id', locale)}: ${group.key}`}</NativeText></View>
          </WorkerQueueCard>
          {group.entries.map((entry, index) => <ReworkRow key={`${entry.id}:${index}`} entry={entry} selected={state.selected.has(entry.id)}
            returned={state.returned} saving={state.saving} text={t} locale={locale} last={index === group.entries.length - 1}
            toggle={() => state.controller.toggle(entry.id)} mileage={() => openMileage(entry.qolip_code)} />)}
        </View>)}
      </OrdersList>}
    {!state.returned && state.selected.size > 0 && <Host matchContents={{ vertical: true }}><Button enabled={!state.saving}
      onClick={returnSelected} modifiers={[testID('qolip-rework-return-selected')]}>
      {state.saving && <CircularProgressIndicator modifiers={[size(18, 18)]} />}
      <Text>{t('return_selected', { count: state.selected.size })}</Text>
    </Button></Host>}
    {dock}<PreparationNotice message={notice.message} />
    {prepared && <ReturnDialog count={prepared.ids.length} text={t} locale={locale} cancel={() => setPrepared(null)} confirm={confirm} />}
  </View>;
}
