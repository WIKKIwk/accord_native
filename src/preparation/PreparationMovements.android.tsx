import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import qrFactory from 'qrcode-generator';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
import { usePreparationContext } from './PreparationContext.android';
import { PreparationInventoryAssignment } from './PreparationInventoryAssignmentSection.android';
import { selectPreparationInventoryDevice } from './preparationDevicePicker.android';
import { preparationInventoryAssetBarcode, preparationInventoryQuantity, preparationInventoryStatus, preparationInventoryTransferTimestamp,
  type PreparationInventoryAsset, type PreparationInventoryTransfer } from './preparationInventory';
import { reprintPreparationInventoryAsset } from './preparationInventoryReprint';
import { PreparationReprintCancelled } from './preparationReprint';
import { PreparationButton, PreparationDialogs, PreparationField, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { usePreparationInventory } from './usePreparationInventory.android';

type Inventory = ReturnType<typeof usePreparationInventory>;

// @v2 InventoryMovementsScreen
export function PreparationInventoryScreen() {
  const { session, home } = usePreparationContext();
  const assigned = home.snapshot?.assigned_warehouses ?? [];
  const inventory = usePreparationInventory(session, assigned), dialogs = usePreparationDialogs(), t = usePreparationText();
  const [asset, setAsset] = useState<PreparationInventoryAsset | null>(null), [transfer, setTransfer] = useState<PreparationInventoryTransfer | null>(null);
  const [scanning, setScanning] = useState(false), [manual, setManual] = useState(''), [manualOpen, setManualOpen] = useState(false), [manualKey, setManualKey] = useState(0);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false), lastScan = useRef('');
  const chooseWarehouse = async () => {
    const value = await dialogs.choose('Ombor', [{ label: 'Barcha omborlar', value: '' },
      ...inventory.warehouses.map(location => ({ label: location.name, value: location.warehouse_id }))], undefined, true);
    if (value !== null) inventory.chooseWarehouse(value);
  };
  const lookup = async (value: string) => {
    if (scanLock.current) return;
    scanLock.current = true;
    try { await inventory.lookup(value); } finally { scanLock.current = false; }
  };
  const window = inventory.tab === 'assets' ? inventory.assets : inventory.transfers;
  const refresh = () => { void Promise.all([inventory.locations.refresh(), window.refresh()]); };
  return <>
    <PreparationPage title="Ishlab chiqarilgan homashyolar" refreshing={window.loading && !!window.rows} onRefresh={refresh}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['assets', 'incoming', 'outgoing'] as const).map(tab => <View key={tab} style={{ flex: 1 }}><PreparationButton
          label={tab === 'assets' ? 'Mahsulotlar' : tab === 'incoming' ? 'Kiruvchi' : 'Chiquvchi'}
          onPress={() => { setScanning(false); inventory.setTab(tab); }} disabled={inventory.tab === tab && !scanning} /></View>)}
      </View>
      <PreparationField label="Mahsulot, kod yoki QR qidirish" onChange={inventory.setQuery} />
      <PreparationRow title={t('Ombor')} subtitle={inventory.warehouses.find(item => item.warehouse_id === inventory.warehouse)?.name ?? t('Barcha omborlar')}
        onPress={() => void chooseWarehouse()} />
      <PreparationButton label={scanning ? 'QR izlashni yopish' : 'QR orqali izlash'} onPress={() => {
        if (!scanning && !permission?.granted) void requestPermission();
        setScanning(!scanning); setManualOpen(false); lastScan.current = ''; inventory.clearQr();
      }} />
      {scanning ? <>
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
      </> : <>
        {inventory.locations.loading || window.loading ? <ActivityIndicator /> : null}
        {inventory.locations.error || window.error ? <><PreparationText>{inventory.locations.error || window.error || ''}</PreparationText>
          <PreparationButton label="Qayta urinish" onPress={refresh} /></> : null}
        {inventory.tab === 'assets' ? <>
          {!inventory.locations.loading && !inventory.warehouses.length ? <PreparationText>{t('Sizga biriktirilgan ombor topilmadi')}</PreparationText> : null}
          {!window.loading && !window.error && inventory.warehouses.length && !inventory.visibleAssets.length ? <PreparationText>{t('Omborda harakatlantiriladigan mahsulot yo‘q')}</PreparationText> : null}
          {inventory.visibleAssets.map(item => <AssetRow key={`${item.kind}:${item.asset_ref}`} asset={item} open={() => setAsset(item)} />)}
        </> : <>
          {!window.loading && !window.error && !inventory.visibleTransfers.length ? <PreparationText>{t(inventory.tab === 'incoming' ? 'Kiruvchi transfer yo‘q' : 'Chiquvchi transfer yo‘q')}</PreparationText> : null}
          {inventory.visibleTransfers.map(item => <PreparationRow key={String(item.id)} title={`${String(item.source_warehouse)} → ${String(item.destination_warehouse)}`}
            subtitle={`${t(preparationInventoryStatus(item.status))} · ${item.lines.map((line: Record<string, unknown>) => String(line.item_name || line.item_code || '')).join(', ')}`}
            onPress={() => setTransfer(item)} />)}
        </>}
      </>}
    </PreparationPage>
    {asset ? <WorkerOrderSheet onClose={() => setAsset(null)} dismissible>
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

function AssetRow({ asset, open }: { asset: PreparationInventoryAsset; open: () => void }) {
  return <PreparationRow title={asset.order_assignment?.order_label || asset.item_name || asset.item_code}
    subtitle={[asset.order_assignment ? asset.item_name || asset.item_code : asset.identifier, `${preparationInventoryQuantity(asset.qty)} ${asset.uom}`,
      asset.custody_warehouse].filter(Boolean).join(' · ')} onPress={open} />;
}

function AssetDetail({ asset, inventory, assigned, close }: { asset: PreparationInventoryAsset; inventory: Inventory; assigned: readonly string[]; close: () => void }) {
  const [showQr, setShowQr] = useState(false), dialogs = usePreparationDialogs(), t = usePreparationText();
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
  if (showQr) return <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 16, gap: 10 }}>
    <PreparationText title>{t('Homashyo QR')}</PreparationText><PreparationText>{asset.item_name || asset.item_code}</PreparationText>
    {image ? <Image source={{ uri: image }} style={{ width: 208, height: 208, alignSelf: 'center', backgroundColor: '#fff' }} contentFit="contain" /> : null}
    {asset.item_code ? <PreparationRow title={t('Mahsulot kodi')} subtitle={asset.item_code} /> : null}
    <PreparationRow title={t('Identifikator')} subtitle={barcode} /><PreparationRow title={t('Miqdor')} subtitle={`${preparationInventoryQuantity(asset.qty)} ${asset.uom}`} />
    {asset.custody_warehouse ? <PreparationRow title={t('Ombor')} subtitle={asset.custody_warehouse} /> : null}
    {asset.physical_location.name ? <PreparationRow title={t('Fizik joy')} subtitle={asset.physical_location.name} /> : null}
    <PreparationRow title={t('Holati')} subtitle={t(preparationInventoryStatus(asset.status))} />
    {notice ? <PreparationText>{t(notice)}</PreparationText> : null}
    <PreparationButton label="Qayta chop etish" disabled={printing} id="preparation-inventory-qr-reprint" onPress={() => void reprint()} />
    <PreparationButton label="Yopish" disabled={printing} onPress={close} />
  </ScrollView>;
  return <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 16, gap: 10 }}>
    <PreparationText title>{asset.item_name || asset.item_code}</PreparationText>
    {asset.item_code && asset.item_name !== asset.item_code ? <PreparationText>{asset.item_code}</PreparationText> : null}
    <PreparationRow title={t('Identifikator')} subtitle={asset.identifier} />
    <PreparationRow title={t('Miqdor')} subtitle={`${preparationInventoryQuantity(asset.qty)} ${asset.uom}`} />
    <PreparationRow title={t('Fizik joy')} subtitle={asset.physical_location.name} />
    <PreparationRow title={t('Holati')} subtitle={t(preparationInventoryStatus(asset.status))} />
    {showAssignment && barcode ? <PreparationInventoryAssignment session={session} barcode={barcode} allowAssignment={inventory.canTransfer(asset)}
      changed={() => inventory.assets.refresh()} isCurrent={inventory.current} />
      : asset.order_assignment ? <PreparationRow title={t('Buyurtma')} subtitle={asset.order_assignment.order_label} /> : null}
    {barcode ? <PreparationButton label="QR kodni ko‘rish" onPress={() => setShowQr(true)} /> : null}
    {owns ? <PreparationButton label="Transfer" disabled={!inventory.canTransfer(asset) || inventory.busy || finished} onPress={() => void transfer()} /> : null}
    <PreparationButton label="Yopish" onPress={close} />
  </ScrollView>;
}
