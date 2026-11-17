import { Button, Column, Host, IconButton, OutlinedTextField, RNHostView, Row, Switch, Text, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { Image } from 'expo-image';
import { Redirect, Stack, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import qrFactory from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Platform, Pressable, ScrollView, Text as NativeText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useNativeSheet } from '../nativeSheet';
import { CustomerSnackbar } from '../customer/CustomerSnackbar.android';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { PickerSheetContent } from '../shared/orders/PickerSheetContent';
import { DeviceSheet } from '../shared/printing/DeviceSheet';
import type { ArchivePrintEntry, ArchiveSession } from './gscaleArchive';
import { gscaleDashboardSections, type GScaleRow } from './gscaleScreenModel';
import type { GScaleOperatorStore } from './gscaleOperatorState';
import type { GScaleModeArgs } from './gscaleRouteArgs';
import { GScaleReceipt } from './GScaleReceipt.android';
import { materialArchiveDetails, materialArchivePrintConfirmation, materialArchivePrintLabel, materialArchivePrintSubtitle, materialArchiveReceiptDetails } from './gscaleMaterialPresentation';
import { useMaterialArchiveReceipt } from './useMaterialArchiveReceipt';
import { useGScalePicker, useGScaleScreen, useGScaleSession, useGScaleText,
  type GScalePickerSpec } from './useGScaleScreen';

const ignoreSnackbarDismiss = () => {};

function Label({ children }: { children: string }) {
  const colors = useMaterialColors();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text color={colors.onSurface}>{children}</Text></Host>;
}
function Action({ label, detail, onPress, disabled: blocked, id }: {
  label: string; detail?: string; onPress(): void; disabled?: boolean; id?: string;
}) {
  const t = useGScaleText();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Button enabled={!blocked} onClick={onPress}
    modifiers={[fillMaxWidth(), ...(id ? [testID(id)] : [])]}><Column><Text>{t(label)}</Text>{detail ? <Text>{t(detail)}</Text> : null}</Column></Button></Host>;
}
function Field({ row }: { row: Extract<GScaleRow, { kind: 'field' }> }) {
  const value = useNativeState(row.value), t = useGScaleText();
  useEffect(() => { if (value.get() !== row.value) value.set(row.value); }, [row.value, value]);
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField value={value} singleLine enabled={!row.disabled}
    keyboardOptions={{ keyboardType: row.decimal ? 'decimal' : 'text' }} onValueChange={row.change} onFocusChanged={row.focus} modifiers={[fillMaxWidth()]}>
    <OutlinedTextField.Label><Text>{t(row.label)}</Text></OutlinedTextField.Label></OutlinedTextField></Host>;
}
function DashboardRow({ row }: { row: GScaleRow }) {
  const t = useGScaleText();
  if (row.kind === 'text' && row.loading) return <ActivityIndicator />;
  if (row.kind === 'text') return <Label>{t(row.text)}</Label>;
  if (row.kind === 'field') return <Field row={row} />;
  if (row.kind === 'toggle') return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Row>
    <Text>{t(row.label)}</Text><Switch value={row.value} enabled={!row.disabled} onCheckedChange={row.change} /></Row></Host>;
  return <Action label={row.label} detail={row.detail} disabled={row.disabled} onPress={row.press} id={row.id} />;
}

function ChoiceSheet({ spec, close, session, preparation = false, material = false }: { spec: GScalePickerSpec; close(): void;
  session: NonNullable<ReturnType<typeof useGScaleSession>['session']>; preparation?: boolean; material?: boolean }) {
  const picker = useGScalePicker(spec, session), search = useNativeState(''), t = useGScaleText(), photoSheet = useNativeSheet();
  const photo = (source: 'camera' | 'library') => { void picker.photoSearch(source).then(query => { if (query) search.set(query); }); };
  const choosePhoto = () => {
    if (material) {
      let selected: 'camera' | 'library' | null = null;
      photoSheet.open(<View style={{ paddingHorizontal: 16, paddingBottom: 20, gap: 8 }}>
        <Action label={picker.photoLabels.take} onPress={() => { selected = 'camera'; photoSheet.close(); }} />
        <Action label={picker.photoLabels.choose} onPress={() => { selected = 'library'; photoSheet.close(); }} />
      </View>, { fitContent: true, dismissible: true, onDismiss: () => { if (selected) photo(selected); } });
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
  return <View style={{ minHeight: 400, padding: 16, gap: 10 }}><Label>{t(spec.title)}</Label>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField value={search} singleLine onValueChange={picker.setQuery} modifiers={[fillMaxWidth()]}>
      <OutlinedTextField.Label><Text>{t(spec.hint)}</Text></OutlinedTextField.Label></OutlinedTextField></Host>
    {spec.photoSearch && <Action label="Rasm orqali qidirish" disabled={picker.photoLoading} onPress={choosePhoto} />}
    {picker.photoLoading && <ActivityIndicator />}{!!picker.photoError && <Label>{picker.photoError}</Label>}
    <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
      {picker.loading && <ActivityIndicator />}{!!picker.error && <><Label>{picker.error}</Label><Action label="Qayta urinish" onPress={picker.retry} /></>}
      {!picker.loading && !picker.error && !picker.items.length && <Label>{t('Hech narsa topilmadi')}</Label>}
      {picker.items.map(item => <Action key={item.key} label={item.title} detail={item.subtitle} onPress={() => { item.select(); close(); }} />)}
      {picker.more && <Action label="Yana yuklash" disabled={picker.loading} onPress={picker.loadMore} />}</ScrollView>
    <Action label="Bekor qilish" onPress={close} /></View>;
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
  return <View style={{ minHeight: 400, padding: 16, gap: 10 }}><Label>{entry ? t('Chop etilgan QR') : batch.item_name || batch.item_code}</Label>
    <ScrollView style={{ maxHeight: 450 }} contentContainerStyle={{ gap: 8 }}>
      {entry ? <><Label>{entry.epc}</Label><Label>{`B ${entry.gross_qty} / N ${entry.net_qty} ${entry.unit} · ${batch.warehouse}`}</Label>
        {!!qr && <Image source={{ uri: qr }} style={{ width: 200, height: 200, backgroundColor: 'white', alignSelf: 'center' }}
          contentFit="contain" accessibilityLabel={t('Chop etilgan QR')} />}
        {!!message && <Label>{t(message)}</Label>}<Action label="Qayta chop etish" disabled={busy} onPress={() => void reprint()} />
        <Action label="Orqaga" onPress={() => { setEntry(null); setMessage(''); }} /></>
        : <>{batch.prints.map((value, index) => <Action key={`${value.epc}:${index}`} label={`${value.epc || '—'} · ${value.net_qty} ${value.unit}`}
          onPress={() => setEntry(value)} />)}{!batch.prints.length && <Label>{t('Chop etilgan QR yo‘q')}</Label>}</>}
    </ScrollView><Action label="Yopish" onPress={close} /></View>;
}

function MaterialArchiveDetailRows({ rows }: { rows: readonly (readonly [string, string])[] }) {
  const colors = useMaterialColors(), t = useGScaleText();
  return <View style={{ gap: 8 }}>{rows.map(([label, value], index) => <View key={`${label}:${index}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
    <NativeText style={{ width: 112, fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant }}>{t(label)}</NativeText>
    <NativeText style={{ flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.onSurface }}>{value}</NativeText>
  </View>)}</View>;
}

/** @v2 _RpsQrReprintSheetState, RpsQrReprintSheet, RpsQrPreview */
function MaterialArchiveReceiptSheet({ batch, entry, operator, close, isCurrent }: {
  batch: ArchiveSession; entry: ArchivePrintEntry; operator: GScaleOperatorStore; close(): void; isCurrent(): boolean;
}) {
  const h = useMaterialArchiveReceipt(entry, operator, isCurrent), colors = useMaterialColors(), t = useGScaleText();
  const qr = useMemo(() => {
    try { const value = qrFactory(0, 'M'); value.addData(entry.epc); value.make(); return value.createDataURL(5, 0); } catch { return ''; }
  }, [entry.epc]);
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainer }}><ScrollView keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}><NativeText style={{ flex: 1, fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.onSurface }}>{t('Chop etilgan QR')}</NativeText>
      <Host style={{ width: 40, height: 40 }}><IconButton enabled={!h.printing} onClick={close} modifiers={[semantics({ contentDescription: t('Yopish') })]}>
        <RNHostView matchContents><SymbolView name={{ android: 'close' }} size={24} tintColor={h.printing ? colors.onSurfaceVariant : colors.onSurface} /></RNHostView>
      </IconButton></Host></View>
    {!!qr && <View style={{ alignSelf: 'center', padding: 16, backgroundColor: 'white', borderRadius: 18 }}><Image source={{ uri: qr }}
      style={{ width: 208, height: 208 }} contentFit="contain" accessibilityLabel={t('Chop etilgan QR')} testID={`batch-receipt-qr-${entry.epc}`} /></View>}
    <View style={{ gap: 4 }}><NativeText style={{ textAlign: 'center', fontSize: 16, lineHeight: 24, fontWeight: '800', color: colors.onSurface }}>{entry.item_name.trim() || batch.item_name || batch.item_code}</NativeText>
      <NativeText selectable style={{ textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '700', letterSpacing: 0.7, color: colors.onSurface }}>{entry.epc}</NativeText></View>
    <MaterialArchiveDetailRows rows={materialArchiveReceiptDetails(batch, entry)} />
    {!!h.error && <NativeText accessibilityRole="alert" style={{ textAlign: 'center', color: colors.error, fontSize: 14, fontWeight: '600' }}>{t(h.error)}</NativeText>}
    <View testID={`batch-receipt-reprint-${entry.epc}`} style={{ paddingTop: 4 }}><WorkerSheetButton label={t(h.printing ? 'Chop etilmoqda…' : 'Qayta chop etish')}
      icon={{ android: 'print' }} height={48} variant="filled" disabled={h.printing} onPress={() => { void h.reprint(); }} /></View>
  </ScrollView><CustomerSnackbar message={h.success ? t(h.success) : ''} messageId={null} onDismiss={ignoreSnackbarDismiss} /></View>;
}

/** @v2 _ArchiveSessionDetailsSheet */
function MaterialArchiveSheet({ batch, operator, isCurrent }: { batch: ArchiveSession; operator: GScaleOperatorStore; isCurrent(): boolean }) {
  const sheet = useNativeSheet(), colors = useMaterialColors(), t = useGScaleText();
  const openReceipt = (entry: ArchivePrintEntry) => {
    if (!entry.epc.trim() || !isCurrent()) return;
    sheet.open(<MaterialArchiveReceiptSheet batch={batch} entry={entry} operator={operator} close={sheet.close} isCurrent={isCurrent} />,
      { dismissible: true, heightFraction: 0.86 });
  };
  return <ScrollView style={{ maxHeight: '100%', backgroundColor: colors.surface }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 16 }}>
    <View style={{ gap: 4 }}><NativeText style={{ fontSize: 24, lineHeight: 32, fontWeight: '800', color: colors.onSurface }}>{batch.item_name || batch.item_code}</NativeText>
      <NativeText style={{ fontSize: 14, lineHeight: 20, color: colors.onSurfaceVariant }}>{t('Batch to‘liq ma’lumotlari')}</NativeText></View>
    <MaterialArchiveDetailRows rows={materialArchiveDetails(batch)} />
    <View style={{ gap: 8 }}><NativeText style={{ fontSize: 16, lineHeight: 24, fontWeight: '800', color: colors.onSurface }}>{t('QR / printlar')}</NativeText>
      {!batch.prints.length && <NativeText style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>{t("Print tarixi hali yo'q.")}</NativeText>}
      {batch.prints.map((entry, index) => <WorkerQueueCard key={`${entry.epc}:${index}`} backgroundColor={colors.surface}
        containerStyle={{ paddingHorizontal: 0 }} first={index === 0} last={index === batch.prints.length - 1} disabled={!entry.epc.trim()}
        onPress={() => openReceipt(entry)} onLongPress={() => openReceipt(entry)}>
        <SymbolView name={{ android: 'playlist_add_check' }} size={24} tintColor={colors.primary} />
        <View style={{ flex: 1, marginHorizontal: 12, gap: 3 }}><NativeText style={{ color: colors.onSurface, fontSize: 14, lineHeight: 20, fontWeight: '700' }}>{materialArchivePrintLabel(entry)}</NativeText>
          <NativeText style={{ color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 17 }}>{materialArchivePrintSubtitle(entry)}</NativeText></View>
        {!!entry.epc.trim() && <Host style={{ width: 40, height: 40 }}><IconButton onClick={() => openReceipt(entry)} modifiers={[semantics({ contentDescription: t('Receipt QR ochish') })]}>
          <RNHostView matchContents><SymbolView name={{ android: 'qr_code_2' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
        </IconButton></Host>}
      </WorkerQueueCard>)}
    </View>
  </ScrollView>;
}

export { Dashboard as GScaleDashboard };
/** @v2 OperatorDashboardPage */
function Dashboard({ session, args, signOut, materialReceipt }: {
  session: NonNullable<ReturnType<typeof useGScaleSession>['session']>; args: GScaleModeArgs; signOut(): void;
  materialReceipt?: { isCurrent(): boolean; onMenu(): void; onProfile(): void };
}) {
  const screen = useGScaleScreen(session, args, { materialReceipt }), sheet = useNativeSheet(), t = useGScaleText(), insets = useSafeAreaInsets(), colors = useMaterialColors();
  const [section, setSection] = useState<'control' | 'history' | 'server'>('control');
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false;
      Alert.alert(t('Chiqish'), t('Hisobdan chiqasizmi?'), [{ text: t('Bekor qilish'), style: 'cancel' },
        { text: t('Chiqish'), onPress: signOut }]);
      return true;
    });
    return () => subscription.remove();
  }, [signOut, t]);
  const pick = (spec: GScalePickerSpec) => {
    const preparation = session.profile.role === 'tayyorlov_masteri' || !!materialReceipt;
    sheet.open(<ChoiceSheet spec={spec} close={sheet.close} session={session} preparation={preparation} material={!!materialReceipt} />,
      preparation ? { dismissible: true, heightFraction: 0.66 } : undefined);
  };
  const chooseApparatus = (options: Record<string, string>) => new Promise<string | null>(resolve => {
    if (materialReceipt) {
      let selected: string | null = null;
      sheet.open(<View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}><Label>{t('Homashyo qaysi apparat uchun?')}</Label>
        {Object.entries(options).map(([key, value]) => <Action key={key} label={value} onPress={() => { selected = key; sheet.close(); }} />)}
      </View>, { onDismiss: () => resolve(materialReceipt.isCurrent() ? selected : null), dismissible: true, fitContent: true });
      return;
    }
    const spec: GScalePickerSpec = { title: 'Apparat tanlang', hint: 'Qidirish', pageSize: 50,
      load: async query => Object.entries(options).filter(([key, value]) => `${key} ${value}`.toLowerCase().includes(query.toLowerCase()))
        .map(([key, value]) => ({ key, title: value, select: () => resolve(key) })) };
    sheet.open(<ChoiceSheet spec={spec} close={sheet.close} session={session} />, { onDismiss: () => resolve(null) });
  });
  const actions = {
    pick, chooseApparatus, devices: () => sheet.open(<DeviceSheet operator={screen.operator} close={sheet.close} useText={useGScaleText} Label={Label} Action={Action}
      materialReceipt={materialReceipt ? { apiBaseUrl: session.baseUrl, isCurrent: materialReceipt.isCurrent } : undefined} />,
      { fitContent: true, dismissible: true }),
    archive: (batch: ArchiveSession) => sheet.open(materialReceipt ? <MaterialArchiveSheet batch={batch} operator={screen.operator} isCurrent={materialReceipt.isCurrent} />
      : <ArchiveSheet batch={batch} operator={screen.operator} close={sheet.close} />, materialReceipt ? { dismissible: true, heightFraction: 0.86 } : undefined),
    confirmArchivePrint: (batch: ArchiveSession) => Alert.alert(t('Partiya QR chop etish'), t(materialReceipt ? materialArchivePrintConfirmation(batch) : 'Shu partiya uchun QR chop etamizmi?'), [
      { text: t(materialReceipt ? 'Yo‘q' : 'Bekor qilish'), style: 'cancel' }, { text: t(materialReceipt ? 'Ha' : 'Chop etish'), onPress: () => { if (!materialReceipt || materialReceipt.isCurrent()) void screen.operator.printArchive(batch); } },
    ]),
  };
  const sections = gscaleDashboardSections(screen, section, actions);
  const exit = () => Alert.alert(t('Chiqish'), t('Hisobdan chiqasizmi?'), [{ text: t('Bekor qilish'), style: 'cancel' },
    { text: t('Chiqish'), onPress: signOut }]);
  const title = screen.controlOnly ? t('Homashyo kirimi') : screen.state.device.selection?.transport === 'wifi'
    ? screen.state.device.selection.server.handshake.serverName : t('Tarozilar rejimi');
  if (screen.controlOnly && (screen.role === 'tayyorlov_masteri' || materialReceipt)) return <><Stack.Screen options={{ headerShown: false }} />
    <GScaleReceipt session={session} title={title} section={section === 'history' ? 'history' : 'control'}
      onSelect={id => { setSection(id); if (id === 'history') void screen.operator.refreshArchive(); }}
      control={gscaleDashboardSections(screen, 'control', actions)} history={gscaleDashboardSections(screen, 'history', actions)}
      connected={!!screen.state.device.selection} attention={screen.state.device.needsAttention}
      refreshing={screen.state.archiveLoading} onRefresh={() => void screen.operator.refreshArchive()} onDevices={actions.devices}
      onBack={() => { if (router.canGoBack()) router.back(); else exit(); }}
      embedded={!!materialReceipt} onMenu={materialReceipt?.onMenu} onProfile={materialReceipt?.onProfile} />
    {materialReceipt && <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 80 + insets.bottom }}>
      <CustomerSnackbar message={screen.state.notice ? t(screen.state.notice) : ''} messageId={screen.state.noticeRevision} onDismiss={screen.operator.dismissNotice} />
    </View>}
  </>;
  return <><Stack.Screen options={{ headerShown: true, title,
    ...(!router.canGoBack() ? { headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel={t('Orqaga')} onPress={exit}>
      <SymbolView name={{ android: 'arrow_back' }} size={24} tintColor={colors.onSurface} /></Pressable> } : {}) }} />
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingBottom: insets.bottom }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 10 }}>
        <Action label={screen.controlOnly ? 'Print' : 'Boshqaruv'} onPress={() => setSection('control')} />
        <Action label={screen.controlOnly ? 'Print tarixi' : 'Arxiv'} onPress={() => { setSection('history'); void screen.operator.refreshArchive(); }} />
        {!screen.controlOnly && <Action label="Server" onPress={() => setSection('server')} />}
        {sections.map((group, index) => <View key={`${section}:${index}`} style={{ gap: 8 }}>
          {group.title ? <Label>{t(group.title)}</Label> : null}
          {group.rows.map((row, rowIndex) => <DashboardRow key={`${row.kind}:${row.kind === 'text' ? rowIndex : row.label}`} row={row} />)}
        </View>)}
      </ScrollView>
    </View></>;
}

// @v2 GScaleModeScreen
export function GScaleScreen({ args }: { args: GScaleModeArgs }) {
  const { session, signOut } = useGScaleSession();
  if (Platform.OS !== 'android' || session === null || (session && !canOpenRoute(session, appRoutes.gscaleMode))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={signOut}>
    <Dashboard session={session} args={args} signOut={signOut} />
  </WorkerSecurityProvider>;
}
