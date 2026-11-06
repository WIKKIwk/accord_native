import { Button, Host, List, Menu, RNHostView, Section, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import qrFactory from 'qrcode-generator';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import type { InventoryViewStore } from '../shared/inventoryViewStore';
import { usePreparationContext } from './PreparationContext';
import { PreparationList, PreparationStatus, usePreparationText } from './PreparationUI';
import { lookupPreparationInventoryQr, preparationInventoryCanTransfer, preparationInventoryIsInternalTransfer,
  requestPreparationInventoryTransfer, type PreparationInventoryAsset as Asset, type PreparationInventoryLocation as Location } from './preparationInventory';
import { usePreparationInventory } from './usePreparationInventory';
import { PreparationInventoryAssignment } from './PreparationInventoryAssignmentSection';

function AssetSheet({ session, asset, warehouses, store }: { session: Session; asset: Asset; warehouses: Location[]; store: InventoryViewStore }) {
  const t = usePreparationText(), [showQr, setShowQr] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const assigned = session.assigned_warehouses ?? [];
  const owns = assigned.some(name => name.trim().toLowerCase() === asset.custody_warehouse.trim().toLowerCase());
  const showAssignment = session.capabilities.includes('raw_material.assign') && owns;
  const barcode = asset.identifier.trim() || asset.asset_ref.replace(/^[^:]*:/, '').trim();
  const qr = useMemo(() => { try { const value = qrFactory(0, 'M'); value.addData(barcode); value.make(); return value.createDataURL(5, 20); } catch { return ''; } }, [barcode]);
  const transfer = (destination: Location) => {
    const internal = preparationInventoryIsInternalTransfer(asset, destination, assigned);
    const explanation = internal ? 'Ikkala ombor ham sizga biriktirilgan. Mahsulot darhol qabul qiluvchi omborga ko‘chiriladi.'
      : 'Qabul qiluvchi tasdiqlamaguncha mahsulot manba omborda band holatda qoladi.';
    Alert.alert(t(internal ? 'Ichki ko‘chirish' : 'Transfer so‘rovi'), `${asset.item_name} (${asset.qty} ${asset.uom})\n${asset.custody_warehouse} → ${destination.name}\n\n${t(explanation)}`, [
      { text: t('Bekor qilish'), style: 'cancel' }, { text: t(internal ? 'Ko‘chirish' : 'So‘rov yuborish'), onPress: () => {
        setBusy(true); setError('');
        void requestPreparationInventoryTransfer(session, asset, destination, assigned).then(async result => {
          if (!activeSessionToken(session)) return;
          await store.reconcileAfterWrite();
          Alert.alert(t(result.status === 'received' ? `${asset.item_name} — ${destination.name} omboriga ko‘chirildi` : 'Transfer so‘rovi yuborildi'));
        }).catch(reason => setError(reason instanceof Error ? reason.message : String(reason))).finally(() => setBusy(false));
      } },
    ]);
  };
  return <Host style={{ minHeight: 350 }}><VStack spacing={10}><Text>{asset.item_name || asset.item_code}</Text><List>
    <Section><Text>{t('Identifikator')}: {asset.identifier}</Text><Text>{t('Miqdor')}: {asset.qty} {asset.uom}</Text>
      <Text>{t('Fizik joy')}: {asset.physical_location.name}</Text><Text>{t('Holat')}: {asset.status}</Text>
      {!showAssignment && !!asset.order_assignment?.order_label && <Text>{t('Buyurtma')}: {asset.order_assignment.order_label}</Text>}
      {!!barcode && <Button label={t('QR kodni ko‘rish')} onPress={() => setShowQr(!showQr)} />}
      {showQr && !!qr && <RNHostView matchContents><Image source={{ uri: qr }} style={{ width: 200, height: 200, backgroundColor: 'white' }} contentFit="contain" /></RNHostView>}
    </Section>
    {showAssignment && !!barcode && <PreparationInventoryAssignment session={session} barcode={barcode}
      allow={preparationInventoryCanTransfer(asset, assigned)} changed={() => store.reconcileAfterWrite()} />}
    {preparationInventoryCanTransfer(asset, assigned) && <Section><Menu label={t('Transfer')} modifiers={[disabled(busy)]}>
      {warehouses.filter(item => item.warehouse_id !== asset.custody_warehouse_id).map(item =>
        <Button key={item.warehouse_id} label={item.name} onPress={() => transfer(item)} />)}
    </Menu></Section>}{!!error && <Section><Text>{error}</Text></Section>}
  </List></VStack></Host>;
}

// @v2 InventoryMovementsScreen
export function PreparationInventory() {
  const { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const model = usePreparationInventory(session), [tab, setTab] = useState<'assets' | 'incoming' | 'outgoing'>('assets');
  const [search, setSearch] = useState(''), [scanning, setScanning] = useState(false), [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState(''), [scanned, setScanned] = useState<Asset[]>([]);
  const [permission, requestPermission] = useCameraPermissions(), scanLock = useRef(false);
  const setQuery = model.setQuery;
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timer); }, [search, setQuery]);
  useEffect(() => registerSessionResetHook(async () => { sheet.close(); setScanned([]); setScanning(false); }), [sheet]);
  const openAsset = (asset: Asset) => sheet.open(<AssetSheet session={session} asset={asset} warehouses={model.warehouses} store={model.store} />,
    { dismissible: true });
  const scan = async (value: string) => {
    if (scanLock.current || !value.trim()) return;
    scanLock.current = true; setScanBusy(true); setScanError('');
    try {
      const results = await lookupPreparationInventoryQr(session, value);
      if (activeSessionToken(session)) setScanned(previous => [...results, ...previous.filter(old => !results.some(item => item.asset_ref === old.asset_ref))]);
    } catch (reason) { if (activeSessionToken(session)) setScanError(reason instanceof Error ? reason.message : String(reason)); }
    finally { scanLock.current = false; setScanBusy(false); }
  };
  const lease = tab === 'assets' ? model.assets : tab === 'incoming' ? model.incoming : model.outgoing;
  const selectedWarehouse = model.warehouses.find(item => item.warehouse_id === model.warehouse);
  const transfers = (lease?.rows ?? []).filter(row => {
    if (tab === 'assets') return true;
    const warehouse = String(tab === 'incoming' ? row.destination_warehouse : row.source_warehouse).trim().toLowerCase();
    if (selectedWarehouse && warehouse !== selectedWarehouse.name.trim().toLowerCase()) return false;
    if (!search.trim()) return true;
    return JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase());
  });
  return <><Stack.Screen options={{ title: t('Ishlab chiqarilgan homashyolar') }} /><PreparationList refresh={async () => { await lease?.refresh(); }}>
    {model.invalidated ? <Section><Text>{t('Akkaunt o‘zgargan. Sahifani qayta oching')}</Text></Section> : <>
      <Section><Menu label={`${t('Ombor')}: ${selectedWarehouse?.name ?? t('Barcha omborlar')}`}>
        <Button label={t('Barcha omborlar')} onPress={() => model.selectWarehouse('')} />
        {model.warehouses.map(item => <Button key={item.warehouse_id} label={item.name} onPress={() => model.selectWarehouse(item.warehouse_id)} />)}
      </Menu><TextField placeholder={t('Mahsulot, kod yoki QR qidirish')} onTextChange={setSearch} />
        <Menu label={t(tab === 'assets' ? 'Mahsulotlar' : tab === 'incoming' ? 'Kiruvchi' : 'Chiquvchi')}>
          <Button label={t('Mahsulotlar')} onPress={() => setTab('assets')} /><Button label={t('Kiruvchi')} onPress={() => setTab('incoming')} />
          <Button label={t('Chiquvchi')} onPress={() => setTab('outgoing')} /></Menu>
        <Button label={t(scanning ? 'Yopish' : 'QR kodni skanerlash')} onPress={() => { setScanning(!scanning); setScanned([]); setScanError(''); }} />
      </Section>
      {scanning ? <Section><Text>{t('QR kodni ramkaga keltiring')}</Text>
        {permission?.granted ? <RNHostView matchContents><CameraView style={{ width: 300, height: 260 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix'] }} onBarcodeScanned={scanBusy || !!scanError ? undefined : event => { void scan(event.data); }} /></RNHostView>
          : <Button label={t('Kameraga ruxsat berish')} onPress={() => { void requestPermission(); }} />}
        {!!scanError && <><Text>{scanError}</Text><Button label={t('Qayta skanerlash')} onPress={() => setScanError('')} /></>}
        {scanned.map(asset => <Button key={asset.asset_ref} label={`${asset.item_name} · ${asset.identifier}`} onPress={() => openAsset(asset)} />)}
      </Section> : <>
        <PreparationStatus loading={!!model.locations?.loading || !!lease?.loading || !lease} error={model.locations?.error ?? lease?.error ?? null}
          retry={() => { void Promise.all([model.locations?.refresh(), lease?.refresh()]); }} />
        {!!lease?.rows && transfers.length === 0 && <Section><Text>{t(tab === 'assets' ? 'Omborda harakatlantiriladigan mahsulot yo‘q' : tab === 'incoming' ? 'Kiruvchi transfer yo‘q' : 'Chiquvchi transfer yo‘q')}</Text></Section>}
        <Section>{tab === 'assets' ? (transfers as Asset[]).map(asset => <Button key={asset.asset_ref} onPress={() => openAsset(asset)}>
          <VStack alignment="leading"><Text>{asset.item_name || asset.item_code}</Text><Text>{asset.identifier} · {asset.qty} {asset.uom} · {asset.physical_location.name}</Text></VStack>
        </Button>) : transfers.map(row => <Button key={String(row.id)} onPress={() => sheet.open(<Host style={{ minHeight: 300 }}><VStack><Text>{String(row.source_warehouse)} → {String(row.destination_warehouse)}</Text>
          <Text>{String(row.status)}</Text><List>{Array.isArray(row.lines) && row.lines.map((line, index) => <Text key={index}>{String(line.item_name ?? line.item_code)} · {String(line.qty)} {String(line.uom)}</Text>)}</List></VStack></Host>, { dismissible: true })}>
          <Text>{String(row.source_warehouse)} → {String(row.destination_warehouse)} · {String(row.status)}</Text></Button>)}</Section>
      </>}
    </>}
  </PreparationList></>;
}
