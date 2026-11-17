import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { extensionText, productionText } from '../shared/localization';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
import { useQolipPrinting } from './useQolipPrinting';
import type { QolipArchiveEntry } from './qolipStorageApi';
import { qolipStorageQr } from './qolipStorageQr';

/** @v2 _showPaddonQr */
export function QolipArchivePaddonQr({ entry, count, close }: { entry: QolipArchiveEntry; count: number; close(): void }) {
  const role = useQolipRole(), { locale } = useQolipText(), colors = useWorkerColors(), printer = useQolipPrinting();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), code = entry.code.trim();
  const t = (key: string) => extensionText('qolipStorageText', key, locale);
  const qr = useMemo(() => qolipStorageQr(`qolip-paddon:${code.toUpperCase()}`), [code]);
  const print = async () => {
    if (busy || !role.isCurrent()) return; setBusy(true); setError('');
    try { if (await printer.printPaddon(code) && role.isCurrent()) role.notice(productionText('worker.paddon.printed', locale, { qr: code })); }
    catch { if (role.isCurrent()) setError(productionText('worker.paddon.print_failed', locale)); }
    finally { if (role.isCurrent()) setBusy(false); }
  };
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', flex: 1 }}>{`${t('paddon')} QR`}</Text>
    <View pointerEvents={busy ? 'none' : 'auto'} accessibilityState={{ disabled: busy }}><WorkerIconButton icon="close" label="Yopish" onPress={() => { if (!busy) close(); }} /></View>
  </View><Image source={{ uri: qr }} style={{ width: 240, height: 240, alignSelf: 'center', backgroundColor: '#fff' }} contentFit="contain" accessibilityLabel={code} />
    <Text style={{ color: colors.text, textAlign: 'center', fontSize: 18, fontWeight: '600' }}>{t('paddon')}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={t('copy')} onPress={() => { if (role.isCurrent()) void Clipboard.setStringAsync(code); }}>
      <Text selectable style={{ color: colors.text, textAlign: 'center', fontWeight: '700' }}>{code}</Text></Pressable>
    <View><Text style={{ color: colors.muted }}>{t('warehouse')}</Text><Text style={{ color: colors.text }}>{entry.warehouse}</Text></View>
    <View><Text style={{ color: colors.muted }}>{t('molds')}</Text><Text style={{ color: colors.text }}>{count}</Text></View>
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: 'center' }}>{error}</Text>}
    <WorkerSheetButton label={busy ? 'Chop etilmoqda…' : 'Qayta chop etish'} variant="filled" height={54} disabled={busy} onPress={() => { void print(); }} />
  </ScrollView>;
}
