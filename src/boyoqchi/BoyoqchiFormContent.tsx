import { Button, Host, RNHostView, TextInput, useNativeState } from '@expo/ui';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../auth';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { useBaseTheme } from '../components/useBaseTheme';
import { paintOptions } from '../workerOrderLogic';
import { BoyoqchiImage } from './BoyoqchiImage';
import { BoyoqchiPaintPalette } from './BoyoqchiPaintPalette';
import { BoyoqchiUsageSwipe } from './BoyoqchiUsageSwipe';
import { boyoqchiInputAllowed, boyoqchiSaveInput } from './boyoqchiLogic';
import type { ReturnedPaintDraft } from './returnedPaintDraft';
import { returnedPaintDouble, type ReturnedPaintItem } from './returnedPaintModel';
import { useBoyoqchiText } from './useBoyoqchiText';

const fieldColors: Record<string, string> = {
  Mix: '#8A6A4A', '1w Oq': '#C9B9AA', '7w Oq': '#C9B9AA', Qora: '#202124', Sariq: '#E0B52D',
  Qizil: '#E53935', 'Ko‘k': '#1E88E5', Spirt: '#6AAED6', 'Mix+': '#8A6A4A', 'Pantone+': '#8E6BBE',
};

type Props = { session: Session; draft: ReturnedPaintDraft; close: () => void; onBusyChange: (busy: boolean) => void;
  save: (items: ReturnedPaintItem[]) => Promise<void> };
function Field({ label, placeholder, initial = '', decimal = false, autoFocus = false, paintField = false, disabled = false, outlineColor, isLocked, onChange }: {
  label: string; placeholder?: string; initial?: string; decimal?: boolean; autoFocus?: boolean; paintField?: boolean; disabled?: boolean;
  outlineColor?: string; isLocked?: () => boolean; onChange: (value: string) => void;
}) {
  const colors = useWorkerColors(), native = useNativeState(initial), last = useRef(initial), t = useBoyoqchiText();
  const [focused, setFocused] = useState(false);
  return <View style={[styles.field, paintField && styles.paintField]}><Text style={{ color: colors.muted }}>{t(label)}</Text>
    <Host matchContents={{ vertical: true }} style={styles.host}><TextInput value={native} placeholder={placeholder === undefined ? undefined : t(placeholder)}
      accessibilityLabel={t(label)} autoFocus={autoFocus} editable={!disabled} keyboardType={decimal ? 'decimal-pad' : 'default'} autoCapitalize={decimal ? 'none' : 'words'}
      style={paintField ? { width: '100%', height: 56, borderRadius: 12, borderWidth: focused ? 1.8 : 1.2,
        borderColor: fieldColors[label] ?? outlineColor ?? colors.muted, paddingHorizontal: 12 } : undefined}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChangeText={value => {
        if (isLocked?.() || (decimal && !boyoqchiInputAllowed(value))) { native.set(last.current); return; }
        last.current = value; onChange(value);
      }} /></Host>
  </View>;
}
function NamedFieldDialog({ paint, close, add, disabled = false, isLocked }: { paint: string; close: () => void;
  add: (name: string, value: string) => void; disabled?: boolean; isLocked?: () => boolean }) {
  const [name, setName] = useState(''), [value, setValue] = useState('');
  const colors = useWorkerColors(), t = useBoyoqchiText();
  const submit = () => {
    if (isLocked?.()) return;
    const label = name.trim(), normalized = value.trim().replace(/,/g, '.'), parsed = returnedPaintDouble(normalized);
    if (label && normalized && parsed !== null && parsed >= 0) add(label, normalized);
  };
  const closeIfAllowed = () => { if (!isLocked?.()) close(); };
  return <Modal visible transparent animationType="fade" onRequestClose={closeIfAllowed}>
    <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={closeIfAllowed} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t(`${paint} maydoni nomi`)}</Text>
        <Field label="Majburiy nom" placeholder="Masalan: Pantone Blue" autoFocus disabled={disabled} isLocked={isLocked} onChange={setName} />
        <Field label="Qiymat" placeholder="Masalan: 12.5" decimal disabled={disabled} isLocked={isLocked} onChange={setValue} />
        <WorkerSheetButton label={t('Bekor qilish')} disabled={disabled} onPress={closeIfAllowed} />
        <WorkerSheetButton label={t('Qo‘shish')} disabled={disabled} onPress={submit} variant="filled" />
      </View>
    </View>
  </Modal>;
}

export function BoyoqchiFormContent({ session, draft, close, onBusyChange, save }: Props) {
  const colors = useWorkerColors(), t = useBoyoqchiText(), theme = useBaseTheme(), [paint, setPaint] = useState<string | null>(null);
  const outlineColor = theme.colors.outlineVariant ?? colors.muted;
  const [dialog, setDialog] = useState<{ paint: string; key: string; base: string[] } | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [, redraw] = useState(0);
  const busyRef = useRef(false), mounted = useRef(true), selectedPaint = useRef<string | null>(null);
  const usage = draft.selectedUsageIndex === 1 ? 'astatka' : 'rasxot';
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => busyRef.current);
    return () => sub.remove();
  }, []);
  const isLocked = () => !mounted.current || busyRef.current;
  const changed = () => { setError(''); redraw(value => value + 1); };
  const changeUsage = (value: 'rasxot' | 'astatka') => {
    if (isLocked() || selectedPaint.current !== null) return;
    draft.setUsage(value === 'astatka' ? 1 : 0); changed();
  };
  const option = paintOptions.find(item => item.name === paint);
  const optionKey = `${usage}:${paint ?? ''}`;
  const fields = option ? draft.fieldLabelsFor(optionKey, option.fields) : [];
  const values = option ? draft.valuesFor(optionKey, fields.length) : [];
  const mixKey = `${usage}:Pantone Mix`, mixFields = paint === 'Pantone' ? draft.fieldLabelsFor(mixKey, []) : [];
  const mixValues = draft.valuesFor(mixKey, mixFields.length);
  const update = (key: string, index: number, value: string, length: number) => {
    if (isLocked()) return;
    draft.setValue(key, index, value, length); changed();
  };
  const addNamed = (name: string, value: string) => {
    if (isLocked() || !dialog) return;
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
    if (isLocked()) return;
    const input = boyoqchiSaveInput(draft);
    if (input.error) { setError(input.error); return; }
    busyRef.current = true; Keyboard.dismiss(); setBusy(true); setError(''); onBusyChange(true);
    try { await save(input.items); close(); }
    catch (failure) {
      if (mounted.current) setError(failure instanceof Error && (failure.name === 'MobileApiException' || failure.name === 'ReturnedPaintReconciliationError' || failure.name === 'BoyoqchiDemoUnavailableError') ? failure.message : 'Qaytarilgan bo‘yoq saqlanmadi');
    } finally {
      busyRef.current = false; onBusyChange(false);
      if (mounted.current) setBusy(false);
    }
  };
  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
      <View style={styles.heading}><View pointerEvents={busy ? 'none' : 'auto'} style={{ opacity: busy ? 0.4 : 1 }}>
        <WorkerIconButton icon="back" label={t('Orqaga')} onPress={() => { if (isLocked()) return; if (paint) { selectedPaint.current = null; setPaint(null); return; } close(); }} />
      </View><Text style={[styles.headingText, { color: colors.text }]}>{t('Qaytarilgan bo‘yoq')}</Text></View>
      {draft.image && <BoyoqchiImage session={session} image={draft.image} disabled={busy} isLocked={isLocked} />}
      {!!error && <View style={[styles.error, { backgroundColor: colors.field }]}><Text style={{ color: colors.text }}>{t(error)}</Text></View>}
      {!paint ? <View pointerEvents={busy ? 'none' : 'auto'}><BoyoqchiUsageSwipe usage={usage} disabled={busy} onUsage={changeUsage}>
        <BoyoqchiPaintPalette draft={draft} usage={usage} onUsage={changeUsage}
          onSelect={(value: string) => {
            if (isLocked() || selectedPaint.current !== null) return;
            selectedPaint.current = value; setPaint(value); setError('');
          }} />
      </BoyoqchiUsageSwipe></View> : <View pointerEvents={busy ? 'none' : 'auto'} style={styles.fields}>
        {fields.map((label, index) => <Field key={`${optionKey}:${index}:${label}`} label={label} decimal paintField disabled={busy} outlineColor={outlineColor} isLocked={isLocked} initial={values[index]}
          onChange={value => update(optionKey, index, value, fields.length)} />)}
        {mixFields.map((label, index) => <Field key={`${mixKey}:${index}:${label}`} label={label} decimal paintField disabled={busy} outlineColor={outlineColor} isLocked={isLocked} initial={mixValues[index]}
          onChange={value => update(mixKey, index, value, mixFields.length)} />)}
        {paint === 'Pantone' && <View style={styles.paintField}><WorkerSheetButton label="Pantone+" height={56} disabled={busy} onPress={() => { if (!isLocked()) setDialog({ paint: 'Pantone', key: optionKey, base: [] }); }} /></View>}
        {paint === 'Pantone' && <View style={styles.paintField}><WorkerSheetButton label="Mix+" height={56} disabled={busy} onPress={() => { if (!isLocked()) setDialog({ paint: 'Mix', key: mixKey, base: [] }); }} /></View>}
        {paint === 'Mix' && <View style={styles.paintField}><WorkerSheetButton label="Mix+" height={56} disabled={busy} onPress={() => { if (!isLocked()) setDialog({ paint, key: optionKey, base: option?.fields ?? [] }); }} /></View>}
        {option?.fields.includes('1w Oq') && <View style={styles.paintField}><WorkerSheetButton label="Pantone+" height={56} disabled={busy} onPress={() => { if (!isLocked()) setDialog({ paint: paint ?? '', key: optionKey, base: option.fields }); }} /></View>}
      </View>}
      <View style={[styles.divider, { backgroundColor: colors.field }]} />
      {busy ? <Host matchContents={{ vertical: true }} style={styles.host}><Button disabled variant="filled" style={{ height: 50 }}>
        <RNHostView matchContents><ActivityIndicator size="small" /></RNHostView>
      </Button></Host> : <WorkerSheetButton label={t('Saqlash')} height={50} variant="filled" onPress={() => { void submit(); }} />}
    </ScrollView>
    {dialog && <NamedFieldDialog paint={dialog.paint} disabled={busy} isLocked={isLocked}
      close={() => { if (!isLocked()) setDialog(null); }} add={addNamed} />}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'center' }, headingText: { flex: 1, fontSize: 22, fontWeight: '800' },
  field: { gap: 4 }, paintField: { flexBasis: '46%', flexGrow: 1, maxWidth: '50%' }, host: { width: '100%' }, fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  divider: { height: StyleSheet.hairlineWidth, width: '100%' }, error: { borderRadius: 12, padding: 10 },
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.32)' },
  dialog: { borderRadius: 24, padding: 24, gap: 12 }, title: { fontSize: 20, fontWeight: '700' },
});
