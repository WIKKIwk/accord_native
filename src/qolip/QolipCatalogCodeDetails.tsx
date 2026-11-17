import { Image } from 'expo-image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
import { useQolipPrinting } from './useQolipPrinting';
import { qolipMileage } from './qolipReworkApi';
import { qolipMileageMeter } from './qolipMileageFormatting';
import { adminText, extensionText } from '../shared/localization';
import type { QolipCatalogProduct } from './qolipProductsState';
import { qolipStorageQr } from './qolipStorageQr';
import { qolipErrorMessage } from './qolipErrorMessage';
import { useWorkerOrderText } from '../components/useWorkerOrderText';
import { WorkerIconButton } from '../components/WorkerIconButton';

/** @v2 showQolipCodeDetailsSheet */
export function QolipCatalogCodeDetails({ product, copy, title, additionalDetails = [], afterDetails, loadMileage = true, canReprint = true, close, cancelAsError = false }: {
  product: QolipCatalogProduct; copy?(code: string): void; title?: string; additionalDetails?: readonly { label: string; value: string }[];
  afterDetails?: ReactNode; loadMileage?: boolean; canReprint?: boolean; close?(): void; cancelAsError?: boolean;
}) {
  const role = useQolipRole(), { text: t, locale } = useQolipText(), colors = useWorkerColors(), printing = useQolipPrinting(), { t: ui } = useWorkerOrderText();
  const [meter, setMeter] = useState<number | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const code = product.qolip_code.trim(), uri = useMemo(() => qolipStorageQr(code), [code]);
  useEffect(() => { if (!loadMileage) return; let active = true; void qolipMileage(role.session, code, role.isCurrent).then(result => { if (active && role.isCurrent() && result.tracking_enabled) setMeter(result.current_meter); }).catch(() => {}); return () => { active = false; }; }, [role, code, loadMileage]);
  return <View style={{ padding: 20, gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', flex: 1 }}>{title ?? t('products.qr_title')}</Text>
      {close && <View pointerEvents={busy ? 'none' : 'auto'} accessibilityState={{ disabled: busy }}><WorkerIconButton icon="close" label={ui('Yopish')} onPress={() => { if (!busy) close(); }} /></View>}</View>
    <Image source={{ uri }} style={{ width: 224, height: 224, alignSelf: 'center', backgroundColor: 'white' }} contentFit="contain" accessibilityLabel={code} />
    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>{product.name.trim() || code}</Text>
    {copy ? <Pressable accessibilityRole="button" accessibilityLabel={adminText('action.copy', locale)} onPress={() => copy(code)}><Text selectable style={{ color: colors.text, textAlign: 'center' }}>{code}</Text></Pressable>
      : <Text selectable style={{ color: colors.text, textAlign: 'center' }}>{code}</Text>}
    {[[t('products.product_code'), product.code], [t('products.size'), product.size > 0 ? String(product.size) : ''], [t('products.customer'), product.customer_names.join(', ')], ...additionalDetails.map(detail => [detail.label, detail.value]),
      [extensionText('qolipReworkText', 'distance', locale), meter !== null ? extensionText('qolipReworkText', 'cycle', locale, { meter: qolipMileageMeter(meter) }) : '']]
      .filter(([, value]) => value.trim()).map(([label, value]) => <View key={label} style={{ gap: 4 }}><Text style={{ color: colors.muted }}>{label}</Text><Text selectable style={{ color: colors.text }}>{value}</Text></View>)}
    {afterDetails}{!!error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}
    {canReprint && <WorkerSheetButton label={ui(busy ? 'Chop etilmoqda…' : 'Qayta chop etish')} disabled={busy} variant="filled" height={54} onPress={() => { if (!role.isCurrent() || busy) return; setBusy(true); setError('');
      void printing.printMold({ qolip_code: code, qolip_color: product.color, customer_name: product.customer_names.join(', ') }).then(done => { if (!role.isCurrent()) return; if (done) role.notice(ui('Mavjud QR qayta chop etildi')); else if (cancelAsError) setError(t('products.qr_failed')); })
        .catch(reason => { if (role.isCurrent()) setError(qolipErrorMessage(reason, locale, t('products.qr_failed'))); }).finally(() => { if (role.isCurrent()) setBusy(false); }); }} />}
  </View>;
}
