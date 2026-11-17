import { Button, Host, List, Picker, ProgressView, RNHostView, Section, Text, TextField, Toggle, VStack, useNativeState } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled, frame, keyboardType, listStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import { Redirect, Stack, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import qrFactory from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, View } from 'react-native';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { CustomerSnackbar } from '../customer/CustomerSnackbar.ios';
import { useNativeSheet } from '../nativeSheet';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { PickerSheetContent } from '../shared/orders/PickerSheetContent';
import { DeviceSheet } from '../shared/printing/DeviceSheet';
import { MaterialArchiveDetails } from './MaterialArchive.ios';
import type { ArchivePrintEntry, ArchiveSession } from './gscaleArchive';
import { gscaleDashboardSections, type GScaleRow } from './gscaleScreenModel';
import type { GScaleOperatorStore } from './gscaleOperatorState';
import type { GScaleModeArgs } from './gscaleRouteArgs';
import { materialArchivePrintConfirmation } from './gscaleMaterialPresentation';
import { useGScalePicker, useGScaleScreen, useGScaleSession, useGScaleText,
  type GScalePickerSpec } from './useGScaleScreen';

function Field({ row }: { row: Extract<GScaleRow, { kind: 'field' }> }) {
  const value = useNativeState(row.value), t = useGScaleText();
  useEffect(() => { if (value.get() !== row.value) value.set(row.value); }, [row.value, value]);
  return <TextField text={value} placeholder={t(row.label)} onTextChange={row.change} onFocusChange={row.focus}
    modifiers={[disabled(!!row.disabled), ...(row.decimal ? [keyboardType('decimal-pad')] : [])]} />;
}

function Row({ row, comfortable = false }: { row: GScaleRow; comfortable?: boolean }) {
  const t = useGScaleText();
  if (row.kind === 'text' && row.loading) return <ProgressView />;
  if (row.kind === 'text') return <Text>{t(row.text)}</Text>;
  if (row.kind === 'field') return <Field row={row} />;
  if (row.kind === 'toggle') return row.detail ? <VStack alignment="leading"><Text>{t(row.label)}</Text>
    <Toggle label={t(row.detail)} isOn={row.value} onIsOnChange={row.change} modifiers={[disabled(!!row.disabled)]} /></VStack>
    : <Toggle label={t(row.label)} isOn={row.value} onIsOnChange={row.change} modifiers={[disabled(!!row.disabled)]} />;
  return <Button modifiers={[disabled(!!row.disabled), ...(comfortable ? [controlSize('large'), frame({ minHeight: 48 }),
    ...(row.id && ['gscale-start', 'gscale-print', 'gscale-stop', 'gscale-save', 'gscale-receive'].includes(row.id)
      ? [buttonStyle('borderedProminent')] : [])] : [])]} onPress={row.press}><VStack alignment="leading">
    <Text>{t(row.label)}</Text>{row.detail ? <Text>{t(row.detail)}</Text> : null}</VStack></Button>;
}

function ChoiceSheet({ spec, close, session, preparation = false, material = false }: { spec: GScalePickerSpec; close(): void;
  session: NonNullable<ReturnType<typeof useGScaleSession>['session']>; preparation?: boolean; material?: boolean }) {
  const picker = useGScalePicker(spec, session), search = useNativeState(''), t = useGScaleText(), photoSheet = useNativeSheet();
  const photo = (source: 'camera' | 'library') => { void picker.photoSearch(source).then(query => { if (query) search.set(query); }); };
  const choosePhoto = () => {
    if (material) {
      let selected: 'camera' | 'library' | null = null;
      photoSheet.open(<Host matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack spacing={12}>
        <Button label={picker.photoLabels.take} systemImage="camera" onPress={() => { selected = 'camera'; photoSheet.close(); }}
          modifiers={[controlSize('large'), frame({ minHeight: 52, maxWidth: Infinity })]} />
        <Button label={picker.photoLabels.choose} systemImage="photo.on.rectangle" onPress={() => { selected = 'library'; photoSheet.close(); }}
          modifiers={[controlSize('large'), frame({ minHeight: 52, maxWidth: Infinity })]} />
      </VStack></Host>, { fitContent: true, dismissible: true, onDismiss: () => { if (selected) photo(selected); } });
      return;
    }
    Alert.alert(t('Rasm orqali qidirish'), '', [
    { text: picker.photoLabels.take, onPress: () => photo('camera') },
    { text: picker.photoLabels.choose, onPress: () => photo('library') }, { text: t('Bekor qilish'), style: 'cancel' },
    ]);
  };
  if (preparation) {
    const content = <PickerSheetContent title={t(spec.title)} hint={t(spec.hint)} closeLabel={t('Yopish')}
    emptyLabel={material ? localizedGetter('noRecordsYet', localeController.locale) : t('Hech narsa topilmadi')} query={picker.query} onSearch={picker.setQuery} onClose={close}
    items={picker.items.map(item => ({ ...item, select: () => { item.select(); close(); } }))}
    loading={picker.loading} error={material && picker.error ? localizedGetter('serverDisconnectedRetry', localeController.locale) : picker.error} retryLabel={t('Qayta urinish')} onRetry={picker.retry}
    hasMore={picker.more} onLoadMore={picker.loadMore} photoLabel={material ? picker.photoLabels.take : t('Rasm orqali qidirish')}
    onPhoto={spec.photoSearch ? choosePhoto : undefined} photoLoading={picker.photoLoading} photoError={material ? undefined : picker.photoError} />;
    return material ? <View style={{ flex: 1 }}>{content}<CustomerSnackbar message={picker.photoError} messageId={null} onDismiss={picker.dismissPhotoError} /></View> : content;
  }
  return <Host style={{ minHeight: 420 }}><VStack><Text>{t(spec.title)}</Text><TextField text={search} placeholder={t(spec.hint)} onTextChange={picker.setQuery} />
    {spec.photoSearch && <Button label={t('Rasm orqali qidirish')} modifiers={[disabled(picker.photoLoading)]} onPress={choosePhoto} />}
    {picker.photoLoading && <ProgressView />}{!!picker.photoError && <Text>{picker.photoError}</Text>}
    <List>{picker.loading && <ProgressView />}{!!picker.error && <Section><Text>{picker.error}</Text><Button label={t('Qayta urinish')} onPress={picker.retry} /></Section>}
      {!picker.loading && !picker.error && !picker.items.length && <Text>{t('Hech narsa topilmadi')}</Text>}
      {picker.items.map(item => <Button key={item.key} onPress={() => { item.select(); close(); }}><VStack alignment="leading"><Text>{item.title}</Text>
        {item.subtitle ? <Text>{item.subtitle}</Text> : null}</VStack></Button>)}
      {picker.more && <Button label={t('Yana yuklash')} modifiers={[disabled(picker.loading)]} onPress={picker.loadMore} />}</List>
    <Button label={t('Bekor qilish')} role="cancel" onPress={close} /></VStack></Host>;
}

function ArchiveSheet({ batch, operator, close }: { batch: ArchiveSession; operator: GScaleOperatorStore; close(): void }) {
  const [entry, setEntry] = useState<ArchivePrintEntry | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const t = useGScaleText();
  const qr = useMemo(() => {
    if (!entry?.epc) return '';
    try { const value = qrFactory(0, 'M'); value.addData(entry.epc); value.make(); return value.createDataURL(5, 20); } catch { return ''; }
  }, [entry]);
  const reprint = async () => {
    if (!entry || busy) return;
    setBusy(true); setMessage('');
    try { setMessage(await operator.reprintArchiveReceipt(entry) ?? 'Mavjud QR qayta chop etildi'); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <Host style={{ minHeight: 420 }}><VStack><Text>{entry ? t('Chop etilgan QR') : batch.item_name || batch.item_code}</Text><List>
    {entry ? <Section><Text>{entry.epc}</Text><Text>{`B ${entry.gross_qty} / N ${entry.net_qty} ${entry.unit} · ${batch.warehouse}`}</Text>
      {!!qr && <RNHostView matchContents><Image source={{ uri: qr }} style={{ width: 200, height: 200, backgroundColor: 'white' }}
        contentFit="contain" accessibilityLabel={t('Chop etilgan QR')} /></RNHostView>}
      {!!message && <Text>{t(message)}</Text>}<Button label={t('Qayta chop etish')} modifiers={[disabled(busy)]} onPress={() => void reprint()} />
      <Button label={t('Orqaga')} onPress={() => { setEntry(null); setMessage(''); }} /></Section>
      : <Section>{batch.prints.map((value, index) => <Button key={`${value.epc}:${index}`} label={`${value.epc || '—'} · ${value.net_qty} ${value.unit}`}
        onPress={() => setEntry(value)} />)}{!batch.prints.length && <Text>{t('Chop etilgan QR yo‘q')}</Text>}</Section>}
  </List><Button label={t('Yopish')} onPress={close} /></VStack></Host>;
}

export { Dashboard as GScaleDashboard };
/** @v2 OperatorDashboardPage */
function Dashboard({ session, args, signOut, materialReceipt }: {
  session: NonNullable<ReturnType<typeof useGScaleSession>['session']>; args: GScaleModeArgs; signOut(): void;
  materialReceipt?: { isCurrent(): boolean; onMenu(): void; onProfile(): void };
}) {
  const screen = useGScaleScreen(session, args, { materialReceipt }), sheet = useNativeSheet(), t = useGScaleText();
  const [section, setSection] = useState<'control' | 'history' | 'server'>('control');
  const pick = (spec: GScalePickerSpec) => {
    const preparation = session.profile.role === 'tayyorlov_masteri' || !!materialReceipt;
    sheet.open(<ChoiceSheet spec={spec} close={sheet.close} session={session} preparation={preparation} material={!!materialReceipt} />,
      preparation ? { dismissible: true, heightFraction: 0.66 } : undefined);
  };
  const chooseApparatus = (options: Record<string, string>) => new Promise<string | null>(resolve => {
    if (materialReceipt) {
      let selected: string | null = null;
      sheet.open(<Host style={{ minHeight: 220 }}><List modifiers={[listStyle('insetGrouped')]}><Section title={t('Homashyo qaysi apparat uchun?')}>
        {Object.entries(options).map(([key, value]) => <Button key={key} label={value} onPress={() => { selected = key; sheet.close(); }}
          modifiers={[controlSize('large'), frame({ minHeight: 52 })]} />)}
      </Section></List></Host>, { onDismiss: () => resolve(materialReceipt.isCurrent() ? selected : null), dismissible: true, fitContent: true });
      return;
    }
    const spec: GScalePickerSpec = { title: 'Apparat tanlang', hint: 'Qidirish', pageSize: 50,
      load: async query => Object.entries(options).filter(([key, value]) => `${key} ${value}`.toLowerCase().includes(query.toLowerCase()))
        .map(([key, value]) => ({ key, title: value, select: () => resolve(key) })) };
    sheet.open(<ChoiceSheet spec={spec} close={sheet.close} session={session} />, { onDismiss: () => resolve(null) });
  });
  const sections = gscaleDashboardSections(screen, section, {
    pick, chooseApparatus, devices: () => sheet.open(<DeviceSheet operator={screen.operator} close={sheet.close} useText={useGScaleText}
      materialReceipt={materialReceipt ? { apiBaseUrl: session.baseUrl, isCurrent: materialReceipt.isCurrent } : undefined} />),
    archive: batch => sheet.open(materialReceipt
      ? <MaterialArchiveDetails batch={batch} operator={screen.operator} close={sheet.close} isCurrent={materialReceipt.isCurrent} />
      : <ArchiveSheet batch={batch} operator={screen.operator} close={sheet.close} />, materialReceipt ? { heightFraction: 0.86, dismissible: true } : undefined),
    confirmArchivePrint: batch => Alert.alert(t('Partiya QR chop etish'), t(materialReceipt ? materialArchivePrintConfirmation(batch) : 'Shu partiya uchun QR chop etamizmi?'), [
      { text: t(materialReceipt ? 'Yo‘q' : 'Bekor qilish'), style: 'cancel' }, { text: t(materialReceipt ? 'Ha' : 'Chop etish'), onPress: () => {
        if (!materialReceipt || materialReceipt.isCurrent()) void screen.operator.printArchive(batch);
      } },
    ]),
  });
  const exit = () => Alert.alert(t('Chiqish'), t('Hisobdan chiqasizmi?'), [{ text: t('Bekor qilish'), style: 'cancel' },
    { text: t('Chiqish'), onPress: signOut }]);
  const title = screen.controlOnly ? t('Homashyo kirimi') : screen.state.device.selection?.transport === 'wifi'
    ? screen.state.device.selection.server.handshake.serverName : t('Tarozilar rejimi');
  return <><Stack.Screen options={{ headerShown: true, title,
    ...(materialReceipt ? { headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel={t('Material bo‘limlari')}
      onPress={materialReceipt.onMenu} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}><SymbolView name="line.3.horizontal" size={23} /></Pressable>,
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel={t('Printer yoki tarozi tanlash')}
        onPress={() => sheet.open(<DeviceSheet operator={screen.operator} close={sheet.close} useText={useGScaleText}
          materialReceipt={{ apiBaseUrl: session.baseUrl, isCurrent: materialReceipt.isCurrent }} />)}
        style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}><SymbolView name="link" size={24} /></Pressable> } : {}),
    ...(session.profile.role === 'tayyorlov_masteri' ? { headerBackButtonDisplayMode: 'minimal' as const } : {}),
    ...(!materialReceipt && !router.canGoBack() ? { headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel={t('Orqaga')} onPress={exit}>
      <SymbolView name="chevron.left" size={20} /></Pressable> } : {}) }} />
    <View style={{ flex: 1 }}><Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped')]}>{materialReceipt ? <Section>
      <Picker selection={section} onSelectionChange={value => { setSection(value as 'control' | 'history'); if (value === 'history') void screen.operator.refreshArchive(); }}
        modifiers={[pickerStyle('segmented'), controlSize('large')]}>
        <Text modifiers={[tag('control')]}>{t('Print')}</Text><Text modifiers={[tag('history')]}>{t('Print tarixi')}</Text>
      </Picker>
    </Section> : <Section>
      <Button label={t(screen.controlOnly ? 'Print' : 'Boshqaruv')} onPress={() => setSection('control')} />
      <Button label={t(screen.controlOnly ? 'Print tarixi' : 'Arxiv')} onPress={() => { setSection('history'); void screen.operator.refreshArchive(); }} />
      {!screen.controlOnly && <Button label={t('Server')} onPress={() => setSection('server')} />}</Section>}
      {sections.map((group, index) => <Section key={`${section}:${index}`} title={group.title ? t(group.title) : undefined}>
        {group.rows.map((row, rowIndex) => <Row key={`${row.kind}:${row.kind === 'text' ? rowIndex : row.label}`} row={row} comfortable={!!materialReceipt} />)}
      </Section>)}</List></Host>
      {materialReceipt && <CustomerSnackbar message={screen.state.notice ? t(screen.state.notice) : ''} messageId={screen.state.noticeRevision} onDismiss={screen.operator.dismissNotice} />}
    </View></>;
}

// @v2 GScaleModeScreen
export function GScaleScreen({ args }: { args: GScaleModeArgs }) {
  const { session, signOut } = useGScaleSession();
  if (Platform.OS !== 'ios' || session === null || (session && !canOpenRoute(session, appRoutes.gscaleMode))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={signOut}>
    <Dashboard session={session} args={args} signOut={signOut} />
  </WorkerSecurityProvider>;
}
