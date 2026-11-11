import { Image } from 'expo-image';
import qrFactory from 'qrcode-generator';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { Session } from '../auth';
import { reprintPreparationInventoryAsset } from '../preparation/preparationInventoryReprint';
import { PreparationReprintCancelled } from '../preparation/preparationReprint';
import { movementBarcode, movementQuantity, movementStatus, movementTimestamp, type MovementAsset } from '../shared/inventoryMovementModel';
import { WorkerOrderSheet } from './WorkerOrderSheet';
import { WorkerSheetButton } from './WorkerSheetButton';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerPrinterSelector } from './useWorkerPrinterSelector';
import type { WorkerInventorySurface } from './useWorkerInventorySurface';

export function WorkerInventorySheet({ session, surface }: { session: Session; surface: WorkerInventorySurface }) {
  const sheet = surface.sheet;
  return sheet ? <WorkerOrderSheet key={sheet.id} dismissible compact onClose={() => surface.dismiss(sheet.id)}>
    <SheetContent session={session} surface={surface} />
  </WorkerOrderSheet> : null;
}
function SheetContent({ session, surface }: { session: Session; surface: WorkerInventorySurface }) {
  const { sheet, t } = surface, close = useContext(WorkerSheetCloseContext), colors = useWorkerColors();
  const [printing, setPrinting] = useState(false);
  if (!sheet) return null;
  const after = (action: () => void) => { surface.afterClose(sheet.id, action); close?.(); };
  const text = (value: string, translate = true) => <Text style={{ color: colors.text, fontSize: 16 }}>{translate ? t(value) : value}</Text>;
  const detail = (label: string, value: string, translateLabel = true) => <View style={{ gap: 3 }}><Text style={{ color: colors.muted }}>{translateLabel ? t(label) : label}</Text>{text(value, false)}</View>;
  return <View style={{ padding: 20, gap: 14 }}>
    {sheet.kind === 'location' ? <>
      {text(sheet.title)}
      {!sheet.locations.length ? text(sheet.empty) : sheet.locations.map(location => <WorkerSheetButton key={location.id}
        label={[location.name, location.apparatus.map(item => item.name).join(', ')].filter(Boolean).join('\n')}
        onPress={() => after(() => sheet.choose(location))} />)}
    </> : sheet.kind === 'transfer' ? <>
      {text(`${sheet.transfer.source_warehouse} → ${sheet.transfer.destination_warehouse}`, false)}
      {text(movementStatus(sheet.transfer.status))}
      {sheet.transfer.lines.map((line: Record<string, unknown>, index: number) => <View key={index}>{detail(String(line.item_name || line.item_code), `${movementQuantity(Number(line.qty))} ${line.uom}`, false)}</View>)}
      {!sheet.transfer.lines.length ? detail('Mahsulot', '—') : null}
      {detail('Sana', movementTimestamp(sheet.transfer))}
      {String(sheet.transfer.note).trim() ? detail('Izoh', String(sheet.transfer.note)) : null}
    </> : sheet.kind === 'qr' ? <InventoryQr session={session} asset={sheet.asset} surface={surface} onPrinting={setPrinting} /> : <>
      {text(sheet.asset.item_name.trim() ? sheet.asset.item_name : sheet.asset.item_code, false)}
      {sheet.asset.item_code.trim() && sheet.asset.item_code.trim() !== (sheet.asset.item_name.trim() || sheet.asset.item_code.trim()) ? text(sheet.asset.item_code, false) : null}
      {text(movementStatus(sheet.asset.status))}
      {movementBarcode(sheet.asset) ? <WorkerSheetButton label={t('QR kodni ko‘rish')} onPress={() => after(() => { if (sheet.asset.kind === 'raw_material') surface.openQr(sheet.asset); })} /> : null}
      {detail('Identifikator', sheet.asset.identifier)}
      {detail('Miqdor', `${movementQuantity(sheet.asset.qty)} ${sheet.asset.uom}`)}
      {detail('Fizik joy', sheet.asset.physical_location.name)}
      {sheet.asset.physical_location.kind !== 'warehouse' ? text('Transfer qilishdan oldin mahsulotni omborga qaytaring.') : null}
      <WorkerSheetButton label={t('Joylashtirish')} disabled={!surface.canRelocate} onPress={() => after(() => surface.chooseRelocation(sheet.asset))} />
      <WorkerSheetButton label={t('Transfer')} variant="filled" disabled={!surface.canTransfer} onPress={() => after(() => surface.chooseTransfer(sheet.asset))} />
    </>}
    <WorkerSheetButton label={t('Yopish')} disabled={printing} onPress={() => close?.()} />
  </View>;
}
function InventoryQr({ session, asset, surface, onPrinting }: { session: Session; asset: MovementAsset; surface: WorkerInventorySurface; onPrinting: (value: boolean) => void }) {
  const { t } = surface, colors = useWorkerColors(), busy = useRef(false), mounted = useRef(true);
  const [printing, setPrinting] = useState(false), [notice, setNotice] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && surface.owner.current();
  const printer = useWorkerPrinterSelector(current), barcode = movementBarcode(asset);
  const image = useMemo(() => { const qr = qrFactory(0, 'M'); qr.addData(barcode); qr.make(); return qr.createDataURL(5, 20); }, [barcode]);
  const reprint = async () => {
    if (busy.current || !current()) return;
    busy.current = true; setPrinting(true); onPrinting(true); setNotice('');
    try {
      const warning = await reprintPreparationInventoryAsset(session, barcode, { isCurrent: current, selectDevice: printer.selectDevice });
      if (current()) setNotice(warning ?? 'Mavjud QR qayta chop etildi');
    } catch (error) { if (current() && !(error instanceof PreparationReprintCancelled)) setNotice(error instanceof Error ? error.message : 'QR kodini qayta chop etib bo‘lmadi'); }
    finally { busy.current = false; if (current()) { setPrinting(false); onPrinting(false); } }
  };
  return <View style={{ gap: 12 }}>
    <Text style={{ color: colors.text, fontSize: 20 }}>{t('Homashyo QR')}</Text>
    <Image source={{ uri: image }} style={{ width: 224, height: 224, alignSelf: 'center', backgroundColor: '#fff' }} contentFit="contain" accessibilityLabel={barcode} />
    <Text style={{ color: colors.text }}>{asset.item_name.trim() || asset.item_code.trim()}</Text>
    <Text selectable style={{ color: colors.text, textAlign: 'center' }}>{barcode}</Text>
    {[['Mahsulot kodi', asset.item_code], ['Identifikator', barcode], ['Miqdor', `${movementQuantity(asset.qty)} ${asset.uom}`], ['Ombor', asset.custody_warehouse], ['Fizik joy', asset.physical_location.name], ['Holati', t(movementStatus(asset.status))]]
      .filter(([, value]) => !!value).map(([label, value]) => <Text key={label} style={{ color: colors.text }}>{t(label)}: {value}</Text>)}
    {!!notice && <Text accessibilityRole="alert" style={{ color: colors.text }}>{t(notice)}</Text>}
    <WorkerSheetButton label={t(printing ? 'Chop etilmoqda…' : 'Qayta chop etish')} disabled={printing} onPress={() => { void reprint(); }} />
    {printer.dialogs}
  </View>;
}
