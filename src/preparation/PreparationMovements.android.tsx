import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import qrFactory from 'qrcode-generator';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { usePreparationContext } from './PreparationContext.android';
import { usePreparationFab } from './PreparationFab.android';
import { PreparationInventoryAssignment } from './PreparationInventoryAssignmentSection.android';
import { InventoryDetailRow, InventorySheetButton, InventorySheetSummary } from './PreparationInventoryDetails.android';
import { selectPreparationInventoryDevice } from './preparationDevicePicker.android';
import { preparationInventoryAssetBarcode, preparationInventoryQuantity, preparationInventoryStatus, preparationInventoryTransferTimestamp,
  type PreparationInventoryAsset, type PreparationInventoryTransfer } from './preparationInventory';
import { reprintPreparationInventoryAsset } from './preparationInventoryReprint';
import { PreparationReprintCancelled } from './preparationReprint';
import { PreparationButton, PreparationDialogs, PreparationDock, PreparationField, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { usePreparationInventory } from './usePreparationInventory.android';

type Inventory = ReturnType<typeof usePreparationInventory>;
type InventoryTab = Inventory['tab'];
const inventoryTabs: InventoryTab[] = ['assets', 'incoming', 'outgoing'];
const passthrough = () => true;

// @v2 InventoryMovementsScreen
export function PreparationInventoryScreen() {
  const { session, home } = usePreparationContext();
  const assigned = home.snapshot?.assigned_warehouses ?? [];
  const inventory = usePreparationInventory(session, assigned), t = usePreparationText();
  const colors = useMaterialColors(), insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(70), [headerSize, setHeaderSize] = useState(70);
  const [asset, setAsset] = useState<PreparationInventoryAsset | null>(null), [transfer, setTransfer] = useState<PreparationInventoryTransfer | null>(null);
  const [scanning, setScanning] = useState(false), [manual, setManual] = useState(''), [manualOpen, setManualOpen] = useState(false), [manualKey, setManualKey] = useState(0);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false), lastScan = useRef('');
  const lookup = async (value: string) => {
    if (scanLock.current) return;
    scanLock.current = true;
    try { await inventory.lookup(value); } finally { scanLock.current = false; }
  };
  const setDockHeight = usePreparationFab('inventory', { actions: [{ id: 'scan', label: t(scanning ? 'QR izlashni yopish' : 'QR orqali izlash'), icon: 'qr_code_scanner', width: 230 }],
    enabled: !asset && !transfer, visible: !asset && !transfer, onSelect: () => {
      if (!scanning && !permission?.granted) void requestPermission();
      setScanning(!scanning); setManualOpen(false); lastScan.current = ''; inventory.clearQr();
    }, openLabel: t('Amallarni ochish'), closeLabel: t('Amallarni yopish') });
  const activeWindow = inventory.tab === 'assets' ? inventory.assets : inventory.tab === 'incoming' ? inventory.incoming : inventory.outgoing;
  const activeCount = inventory.tab === 'assets' ? inventory.visibleAssets.length : inventory.tab === 'incoming' ? inventory.visibleIncoming.length : inventory.visibleOutgoing.length;
  useEffect(() => {
    if (!scanning && !activeWindow.loading && !activeWindow.error && activeWindow.hasMore && activeCount === 0) activeWindow.loadMore();
  }, [scanning, activeWindow, activeCount]);
  const header = <View onLayout={event => { const height = event.nativeEvent.layout.height;
    if (height > 0) { headerHeight.set(height); setHeaderSize(height); } }}>
    <OrdersHeader search={inventory.query} searchPlaceholder={t('Qidirish')} onSearchChange={inventory.setQuery}
      onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/android-preparation' as Href); }}
      onProfile={() => router.navigate('/android-preparation/profile' as Href)} />
  </View>;
  return <>
    <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <OrdersWorkspace session={session} tabs={inventoryTabs.map(id => ({ id, name: t(id === 'assets' ? 'Mahsulotlar' : id === 'incoming' ? 'Kiruvchi' : 'Chiquvchi') }))}
      selected={inventory.tab} distributeTabs header={header} headerOffset={headerOffset}
      onSelect={id => { if (inventoryTabs.includes(id as InventoryTab)) { setScanning(false); inventory.setTab(id as InventoryTab); } }}>
      {(id, pagerGesture) => {
        const tab = id as InventoryTab, window = tab === 'assets' ? inventory.assets : tab === 'incoming' ? inventory.incoming : inventory.outgoing;
        const rows = tab === 'incoming' ? inventory.visibleIncoming : inventory.visibleOutgoing;
        const scanVisible = scanning && tab === inventory.tab;
        return <OrdersList active={tab === inventory.tab} pagerGesture={pagerGesture} headerOffset={headerOffset} headerHeight={headerHeight}
          topInset={headerSize + 48} passthrough={passthrough}
          onRefresh={async () => { await Promise.all([inventory.locations.refresh(), window.refresh()]); }}
          onEndReached={() => { if (tab === inventory.tab && !scanning) window.loadMore(); }}>
        <DropdownFilter label={t('Ombor')} selectedLabel={inventory.warehouses.find(item => item.warehouse_id === inventory.warehouse)?.name ?? t('Barcha omborlar')}
          backgroundColor={colors.surface} options={[{ value: '', label: t('Barcha omborlar') }, ...inventory.warehouses.map(location => ({ value: location.warehouse_id, label: location.name }))]}
          onChange={inventory.chooseWarehouse} />
      {scanVisible ? <View style={styles.scan}>
        <PreparationText>{t('QR kodni ramkaga keltiring')}</PreparationText>
        {permission?.granted ? <CameraView style={{ height: 280, width: '100%' }} barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix'] }}
          onBarcodeScanned={inventory.busy ? undefined : ({ data }) => { if (data !== lastScan.current) { lastScan.current = data; void lookup(data); } }} />
          : <PreparationText>{t('Kamera ochilmadi. Quyidagi maydonga QR yoki barcode kiriting.')}</PreparationText>}
        <PreparationButton label={manualOpen ? 'Barcode maydonini yopish' : 'Barcode kiritish'} onPress={() => setManualOpen(value => !value)} />
        {manualOpen && <><PreparationField key={manualKey} label="QR / barcode" onChange={setManual} enabled={!inventory.busy} />
          <PreparationButton label="Qabul qilish" disabled={inventory.busy || !manual.trim()} onPress={() => {
            void lookup(manual).then(() => { setManual(''); setManualKey(value => value + 1); });
          }} /></>}
        {inventory.busy ? <ActivityIndicator /> : null}{inventory.qrError ? <PreparationText>{inventory.qrError}</PreparationText> : null}
        {inventory.qrAssets.map(item => <AssetRow key={`${item.kind}:${item.asset_ref}`} asset={item} open={() => setAsset(item)} />)}
      </View> : null}
      {!scanVisible && (inventory.locations.error || window.error) ? <View style={styles.status}><PreparationText>{inventory.locations.error || window.error || ''}</PreparationText>
        <PreparationButton label="Qayta urinish" onPress={() => { void Promise.all([inventory.locations.refresh(), window.refresh()]); }} /></View> : null}
      {!scanVisible && tab === 'assets' && !inventory.locations.loading && !inventory.warehouses.length ? <View style={styles.status}><PreparationText>{t('Sizga biriktirilgan ombor topilmadi')}</PreparationText></View> : null}
      {!scanVisible && tab === 'assets' && !window.loading && !window.error && inventory.warehouses.length && !inventory.visibleAssets.length && !window.hasMore
        ? <View style={styles.status}><PreparationText>{t('Omborda harakatlantiriladigan mahsulot yo‘q')}</PreparationText></View> : null}
      {!scanVisible && tab === 'assets' && inventory.visibleAssets.map((item, index) => <AssetRow key={`${item.kind}:${item.asset_ref}`} asset={item}
        last={index === inventory.visibleAssets.length - 1} open={() => setAsset(item)} />)}
      {!scanVisible && tab !== 'assets' && !window.loading && !window.error && !rows.length && !window.hasMore
        ? <View style={styles.status}><PreparationText>{t(tab === 'incoming' ? 'Kiruvchi transfer yo‘q' : 'Chiquvchi transfer yo‘q')}</PreparationText></View> : null}
      {!scanVisible && tab !== 'assets' && rows.map((item, index) => <InventoryRow key={String(item.id)}
        title={`${String(item.source_warehouse)} → ${String(item.destination_warehouse)}`} last={index === rows.length - 1}
        subtitle={`${t(preparationInventoryStatus(item.status))} · ${item.lines.map((line: Record<string, unknown>) => String(line.item_name || line.item_code || '')).join(', ')}`}
        open={() => setTransfer(item)} />)}
      {!scanVisible && (inventory.locations.loading || window.loading) ? <ActivityIndicator style={styles.status} /> : null}
      <View style={styles.fabSpace} />
      </OrdersList>;
      }}
    </OrdersWorkspace>
    <View onLayout={event => setDockHeight(event.nativeEvent.layout.height)}><PreparationDock /></View>
    </View>
    {asset ? <WorkerOrderSheet onClose={() => setAsset(null)} dismissible fitContent>
      <PreparationDialogs><AssetDetail asset={asset} inventory={inventory} assigned={assigned} close={() => setAsset(null)} /></PreparationDialogs>
    </WorkerOrderSheet> : null}
    {transfer ? <WorkerOrderSheet onClose={() => setTransfer(null)} dismissible compact>
      <PreparationText title>{`${String(transfer.source_warehouse)} → ${String(transfer.destination_warehouse)}`}</PreparationText>
      <PreparationText>{t(preparationInventoryStatus(transfer.status))}</PreparationText>
      {transfer.lines.map((line: Record<string, unknown>, index: number) => <PreparationRow key={index} title={String(line.item_name || line.item_code || '')}
        subtitle={`${preparationInventoryQuantity(line.qty as number)} ${String(line.uom ?? '')}`} />)}
      {!transfer.lines.length ? <PreparationRow title={t('Mahsulot')} subtitle="—" /> : null}
      <PreparationRow title={t('Sana')} subtitle={preparationInventoryTransferTimestamp(transfer)} />
      {transfer.note ? <PreparationRow title={t('Izoh')} subtitle={String(transfer.note)} /> : null}
      <PreparationButton label="Yopish" onPress={() => setTransfer(null)} />
    </WorkerOrderSheet> : null}
  </>;
}

function AssetRow({ asset, open, last }: { asset: PreparationInventoryAsset; open: () => void; last?: boolean }) {
  return <InventoryRow title={asset.order_assignment?.order_label || asset.item_name || asset.item_code} last={last}
    subtitle={[asset.order_assignment ? asset.item_name || asset.item_code : asset.identifier, `${preparationInventoryQuantity(asset.qty)} ${asset.uom}`,
      asset.custody_warehouse].filter(Boolean).join(' · ')} open={open} />;
}

function InventoryRow({ title, subtitle, last, open }: { title: string; subtitle: string; last?: boolean; open: () => void }) {
  const colors = useMaterialColors();
  return <WorkerQueueCard backgroundColor={colors.surface} last={last} onPress={open}>
    <View accessible={false} style={[styles.icon, { backgroundColor: colors.surfaceContainerHighest }]}>
      <SymbolView name={{ android: 'inventory_2' }} size={20} tintColor={colors.onSurfaceVariant} /></View>
    <View style={styles.rowText}><NativeText style={[styles.headline, { color: colors.onSurface }]}>{title}</NativeText>
      <NativeText style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{subtitle}</NativeText></View>
  </WorkerQueueCard>;
}

const styles = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, marginStart: 16, paddingVertical: 6 },
  headline: { fontSize: 16, lineHeight: 24, includeFontPadding: false, fontWeight: '500' },
  supporting: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
  scan: { padding: 16, gap: 10 }, status: { padding: 16 }, fabSpace: { height: 112 },
  sheet: { flexShrink: 1 },
  sheetContent: { padding: 16, gap: 12 },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetActions: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 4, borderTopWidth: StyleSheet.hairlineWidth },
  sheetMainActions: { flexDirection: 'row', gap: 8 },
  sheetAction: { flex: 1 },
  sheetCodes: { gap: 12 },
});

function AssetDetail({ asset, inventory, assigned, close }: { asset: PreparationInventoryAsset; inventory: Inventory; assigned: readonly string[]; close: () => void }) {
  const [showQr, setShowQr] = useState(false), dialogs = usePreparationDialogs(), t = usePreparationText();
  const [showCodes, setShowCodes] = useState(false);
  const colors = useMaterialColors();
  const { height } = useWindowDimensions(), insets = useSafeAreaInsets();
  const sheetStyle = [styles.sheet, { maxHeight: Math.round((height - insets.top - insets.bottom) * 0.72) }];
  const { session } = usePreparationContext();
  const [finished, setFinished] = useState(false), [printing, setPrinting] = useState(false), [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true), printBusy = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && inventory.current();
  const barcode = preparationInventoryAssetBarcode(asset);
  const owns = assigned.some(name => name.trim().toLowerCase() === asset.custody_warehouse.trim().toLowerCase());
  const showAssignment = session.capabilities.includes('raw_material.assign') && owns;
  const image = useMemo(() => { try { const qr = qrFactory(0, 'M'); qr.addData(barcode); qr.make(); return qr.createDataURL(5, 20); } catch { return null; } }, [barcode]);
  const transfer = async () => {
    if (!inventory.canTransfer(asset)) return;
    const choices = inventory.warehouses.filter(location => location.warehouse_id !== asset.custody_warehouse_id);
    if (!choices.length) { dialogs.message('Qabul qiluvchi ombor', 'Boshqa ombor topilmadi'); return; }
    const id = await dialogs.choose('Qabul qiluvchi ombor', choices.map(location => ({ label: location.name, value: location.warehouse_id })), undefined, true);
    const destination = choices.find(location => location.warehouse_id === id);
    if (!destination || !inventory.current()) return;
    const internal = assigned.some(name => name.trim().toLowerCase() === destination.name.trim().toLowerCase());
    const title = internal ? 'Ichki ko‘chirish' : 'Transfer so‘rovi';
    const explanation = internal ? 'Ikkala ombor ham sizga biriktirilgan. Mahsulot darhol qabul qiluvchi omborga ko‘chiriladi.'
      : 'Qabul qiluvchi tasdiqlamaguncha mahsulot manba omborda band holatda qoladi.';
    if (!await dialogs.confirm(title, `${asset.item_name} (${asset.qty} ${asset.uom})\n${asset.custody_warehouse} → ${destination.name}\n\n${explanation}`,
      internal ? 'Ko‘chirish' : 'So‘rov yuborish') || !inventory.current()) return;
    try {
      const result = await inventory.transfer(asset, destination);
      if (result && inventory.current()) { setFinished(true); dialogs.message(title, result.status === 'received' ? `${asset.item_name} — ${destination.name} omboriga ko‘chirildi` : 'Transfer so‘rovi yuborildi'); }
    } catch (error) { if (inventory.current()) dialogs.message('Xatolik yuz berdi', error instanceof Error ? error.message : String(error)); }
  };
  const reprint = async () => {
    if (printBusy.current || !current()) return;
    printBusy.current = true; setPrinting(true); setNotice(null);
    try {
      const warning = await reprintPreparationInventoryAsset(session, barcode,
        { isCurrent: current, selectDevice: () => selectPreparationInventoryDevice(dialogs, current) });
      if (current()) setNotice(warning ?? 'Mavjud QR qayta chop etildi');
    } catch (error) {
      if (current() && !(error instanceof PreparationReprintCancelled)) setNotice(error instanceof Error ? error.message : 'QR kodini qayta chop etib bo‘lmadi');
    } finally { printBusy.current = false; if (current()) setPrinting(false); }
  };
  const summary = <InventorySheetSummary title={asset.item_name || asset.item_code}
    quantity={`${preparationInventoryQuantity(asset.qty)} ${asset.uom}`} status={t(preparationInventoryStatus(asset.status))} />;
  const separateLocation = asset.physical_location.name && (asset.physical_location.kind !== 'warehouse' ||
    asset.physical_location.name.trim().toLowerCase() !== asset.custody_warehouse.trim().toLowerCase());
  const location = <>
    <InventoryDetailRow label="Ombor" value={asset.custody_warehouse} />
    {separateLocation ? <InventoryDetailRow label="Fizik joy" value={asset.physical_location.name} /> : null}
  </>;
  const codes = <View style={styles.sheetCodes}>
    <InventorySheetButton label={showCodes ? 'Kodlarni yashirish' : 'Kodlarni ko‘rsatish'} kind="text" onPress={() => setShowCodes(value => !value)} />
    {showCodes ? <>
      {asset.item_code ? <InventoryDetailRow label="Mahsulot kodi" value={asset.item_code} stacked /> : null}
      <InventoryDetailRow label="Identifikator" value={showQr ? barcode : asset.identifier} stacked />
    </> : null}
  </View>;
  if (showQr) return <View style={sheetStyle}>
    <ScrollView key="qr" nestedScrollEnabled style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
      {summary}
      {image ? <Image source={{ uri: image }} style={{ width: 176, height: 176, alignSelf: 'center', backgroundColor: '#fff' }} contentFit="contain" /> : null}
      <View>{location}</View>
      {codes}
      {notice ? <PreparationText>{t(notice)}</PreparationText> : null}
    </ScrollView>
    <View style={[styles.sheetActions, { borderTopColor: colors.outlineVariant }]}>
      <InventorySheetButton label="Qayta chop etish" disabled={printing} id="preparation-inventory-qr-reprint" onPress={() => void reprint()} />
      <InventorySheetButton label="Yopish" kind="text" disabled={printing} onPress={close} />
    </View>
  </View>;
  return <View style={sheetStyle}>
    <ScrollView key="details" nestedScrollEnabled style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
      {summary}
      <View>
        {location}
        {showAssignment && barcode ? <PreparationInventoryAssignment session={session} barcode={barcode} allowAssignment={inventory.canTransfer(asset)}
          changed={() => inventory.assets.refresh()} isCurrent={inventory.current} />
          : asset.order_assignment ? <InventoryDetailRow label="Buyurtma" value={asset.order_assignment.order_label} /> : null}
      </View>
      {codes}
    </ScrollView>
    <View style={[styles.sheetActions, { borderTopColor: colors.outlineVariant }]}>
      <View style={styles.sheetMainActions}>
        {barcode ? <View style={styles.sheetAction}><InventorySheetButton label="QR kodni ko‘rish" onPress={() => setShowQr(true)} /></View> : null}
        {owns ? <View style={styles.sheetAction}><InventorySheetButton label="Transfer" kind="outlined" disabled={!inventory.canTransfer(asset) || inventory.busy || finished} onPress={() => void transfer()} /></View> : null}
      </View>
      <InventorySheetButton label="Yopish" kind="text" onPress={close} />
    </View>
  </View>;
}
