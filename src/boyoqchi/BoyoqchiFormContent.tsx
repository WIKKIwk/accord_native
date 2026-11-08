import { Button, Host, RNHostView, TextInput, useNativeState } from '@expo/ui';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../auth';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { WorkerPaintPalette } from '../components/WorkerPaintPalette';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { paintOptions } from '../workerOrderLogic';
import { BoyoqchiImage } from './BoyoqchiImage';
import { boyoqchiInputAllowed, boyoqchiSaveInput } from './boyoqchiLogic';
import type { ReturnedPaintDraft } from './returnedPaintDraft';
import { returnedPaintDouble, type ReturnedPaintItem } from './returnedPaintModel';
import { useBoyoqchiText } from './useBoyoqchiText';

type Props = { session: Session; draft: ReturnedPaintDraft; close: () => void; onBusyChange: (busy: boolean) => void;
  save: (items: ReturnedPaintItem[]) => Promise<void> };
function Field({ label, placeholder, initial = '', decimal = false, autoFocus = false, onChange }: {
  label: string; placeholder?: string; initial?: string; decimal?: boolean; autoFocus?: boolean; onChange: (value: string) => void;
}) {
  const colors = useWorkerColors(), native = useNativeState(initial), last = useRef(initial), t = useBoyoqchiText();
  return <View style={styles.field}><Text style={{ color: colors.muted }}>{t(label)}</Text>
    <Host matchContents={{ vertical: true }} style={styles.host}><TextInput value={native} placeholder={placeholder === undefined ? undefined : t(placeholder)}
      accessibilityLabel={t(label)} autoFocus={autoFocus} keyboardType={decimal ? 'decimal-pad' : 'default'} autoCapitalize={decimal ? 'none' : 'words'}
      onChangeText={value => {
        if (decimal && !boyoqchiInputAllowed(value)) { native.set(last.current); return; }
        last.current = value; onChange(value);
      }} /></Host>
  </View>;
}
function NamedFieldDialog({ paint, close, add }: { paint: string; close: () => void; add: (name: string, value: string) => void }) {
  const [name, setName] = useState(''), [value, setValue] = useState('');
  const colors = useWorkerColors(), t = useBoyoqchiText();
  const submit = () => {
    const label = name.trim(), normalized = value.trim().replace(/,/g, '.'), parsed = returnedPaintDouble(normalized);
    if (label && normalized && parsed !== null && parsed >= 0) add(label, normalized);
  };
  return <Modal visible transparent animationType="fade" onRequestClose={close}>
    <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t(`${paint} maydoni nomi`)}</Text>
        <Field label="Majburiy nom" placeholder="Masalan: Pantone Blue" autoFocus onChange={setName} />
        <Field label="Qiymat" placeholder="Masalan: 12.5" decimal onChange={setValue} />
        <WorkerSheetButton label={t('Bekor qilish')} onPress={close} />
        <WorkerSheetButton label={t('Qo‘shish')} onPress={submit} variant="filled" />
      </View>
    </View>
  </Modal>;
}

export function BoyoqchiFormContent({ session, draft, close, onBusyChange, save }: Props) {
  const colors = useWorkerColors(), t = useBoyoqchiText(), [paint, setPaint] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ paint: string; key: string; base: string[] } | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [, redraw] = useState(0);
  const busyRef = useRef(false), mounted = useRef(true);
  const usage = draft.selectedUsageIndex === 1 ? 'astatka' : 'rasxot';
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => busyRef.current);
    return () => sub.remove();
  }, []);
  const changed = () => { setError(''); redraw(value => value + 1); };
  const option = paintOptions.find(item => item.name === paint);
  const optionKey = `${usage}:${paint ?? ''}`;
  const fields = option ? draft.fieldLabelsFor(optionKey, option.fields) : [];
  const values = option ? draft.valuesFor(optionKey, fields.length) : [];
  const mixKey = `${usage}:Pantone Mix`, mixFields = paint === 'Pantone' ? draft.fieldLabelsFor(mixKey, []) : [];
  const mixValues = draft.valuesFor(mixKey, mixFields.length);
  const update = (key: string, index: number, value: string, length: number) => { draft.setValue(key, index, value, length); changed(); };
  const addNamed = (name: string, value: string) => {
    if (!dialog) return;
    const { key, base } = dialog;
    setDialog(null);
    if (draft.dynamicFieldLabelsFor(key).some(item => item.toLowerCase() === name.toLowerCase())) {
      setError('Bu nom allaqachon qo‘shilgan.'); return;
    }
    draft.addNamedField(key, name);
    const next = draft.fieldLabelsFor(key, base);
    draft.setValue(key, next.length - 1, value, next.length);
    changed();
  };
  const submit = async () => {
    if (busyRef.current) return;
    const input = boyoqchiSaveInput(draft);
    if (input.error) { setError(input.error); return; }
    busyRef.current = true; setBusy(true); setError(''); onBusyChange(true);
    try { await save(input.items); close(); }
    catch (failure) {
      if (mounted.current) setError(failure instanceof Error && failure.name === 'MobileApiException' ? failure.message : 'Qaytarilgan bo‘yoq saqlanmadi');
    } finally {
      busyRef.current = false; onBusyChange(false);
      if (mounted.current) setBusy(false);
    }
  };
  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
      <View style={styles.heading}><View pointerEvents={busy ? 'none' : 'auto'} style={{ opacity: busy ? 0.4 : 1 }}>
        <WorkerIconButton icon="back" label={t('Orqaga')} onPress={() => { if (paint) { setPaint(null); return; } close(); }} />
      </View><Text style={[styles.headingText, { color: colors.text }]}>{t('Qaytarilgan bo‘yoq')}</Text></View>
      {draft.image && <BoyoqchiImage session={session} image={draft.image} />}
      {!!error && <View style={[styles.error, { backgroundColor: colors.field }]}><Text style={{ color: colors.text }}>{t(error)}</Text></View>}
      {!paint ? <WorkerPaintPalette usage={usage} onUsage={(value: 'rasxot' | 'astatka') => { draft.setUsage(value === 'astatka' ? 1 : 0); changed(); }}
        onSelect={(value: string) => { setPaint(value); setError(''); }} /> : <View style={styles.fields}>
        {fields.map((label, index) => <Field key={`${optionKey}:${index}:${label}`} label={label} decimal initial={values[index]}
          onChange={value => update(optionKey, index, value, fields.length)} />)}
        {mixFields.map((label, index) => <Field key={`${mixKey}:${index}:${label}`} label={label} decimal initial={mixValues[index]}
          onChange={value => update(mixKey, index, value, mixFields.length)} />)}
        {paint === 'Pantone' && <WorkerSheetButton label="Pantone+" onPress={() => setDialog({ paint: 'Pantone', key: optionKey, base: [] })} />}
        {paint === 'Pantone' && <WorkerSheetButton label="Mix+" onPress={() => setDialog({ paint: 'Mix', key: mixKey, base: [] })} />}
        {paint === 'Mix' && <WorkerSheetButton label="Mix+" onPress={() => setDialog({ paint, key: optionKey, base: option?.fields ?? [] })} />}
        {option?.fields.includes('1w Oq') && <WorkerSheetButton label="Pantone+" onPress={() => setDialog({ paint: paint ?? '', key: optionKey, base: option.fields })} />}
      </View>}
      <View style={[styles.divider, { backgroundColor: colors.field }]} />
      {busy ? <Host matchContents={{ vertical: true }} style={styles.host}><Button disabled variant="filled" style={{ height: 50 }}>
        <RNHostView matchContents><ActivityIndicator size="small" /></RNHostView>
      </Button></Host> : <WorkerSheetButton label={t('Saqlash')} height={50} variant="filled" onPress={() => { void submit(); }} />}
    </ScrollView>
    {dialog && <NamedFieldDialog paint={dialog.paint} close={() => setDialog(null)} add={addNamed} />}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'center' }, headingText: { flex: 1, fontSize: 22, fontWeight: '800' },
  field: { minWidth: '46%', flexGrow: 1, gap: 4 }, host: { width: '100%' }, fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  divider: { height: StyleSheet.hairlineWidth, width: '100%' }, error: { borderRadius: 12, padding: 10 },
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.32)' },
  dialog: { borderRadius: 24, padding: 24, gap: 12 }, title: { fontSize: 20, fontWeight: '700' },
});
