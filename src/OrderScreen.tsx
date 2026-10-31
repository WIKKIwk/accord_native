import { Button, Host, TextInput as NativeInput } from '@expo/ui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';

type Obj = Record<string, any>;
type Props = { session: Session; apparatusId: string; orderId: string; onClose: () => void; onChanged: () => void };
type ScanKind = 'material' | 'qolip';
const actionLabels: Record<string, string> = { start: 'Boshlash', pause: 'To‘xtatish', resume: 'Davom ettirish', roll_complete: 'Rulonni yakunlash', complete: 'Buyurtmani yakunlash' };
const paintColors = ['Oq', 'Sariq', 'Qizil', 'Ko‘k', 'Tilla', 'Kumush', 'Qora'];
const paintFields = ['Mix', '1w Oq', '7w Oq', 'Qora', 'Sariq', 'Qizil', 'Ko‘k', 'Spirt'];
const numberValue = (v: string) => Number(v.trim().replace(',', '.'));
function barcodeFromQr(raw: string) {
  const value = raw.trim();
  try {
    const url = new URL(value);
    if (!url.host) return value;
    for (const key of ['barcode', 'epc', 'qr']) {
      const candidate = url.searchParams.get(key)?.trim();
      if (candidate) return candidate;
    }
    const part = url.pathname.split('/').pop()?.trim();
    return part ? decodeURIComponent(part).trim() || value : value;
  } catch { return value; }
}

async function request(session: Session, path: string, init?: RequestInit): Promise<Obj> {
  const response = await authorizedFetch(session, path, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  const text = await response.text();
  let data: Obj = {};
  try { data = JSON.parse(text); } catch { if (!response.ok) throw new Error(`Server xatosi (${response.status})`); }
  if (!response.ok) throw new Error(String(data.detail || data.message || data.error || `Server xatosi (${response.status})`));
  return data;
}

function Field({ label, onChangeText, keyboardType }: { label: string; onChangeText: (s: string) => void; keyboardType?: 'decimal-pad' | 'default' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><Host matchContents={{ vertical: true }} style={styles.host}><NativeInput placeholder={label} onChangeText={onChangeText} keyboardType={keyboardType ?? 'default'} /></Host></View>;
}
function NativeButton({ label, onPress, disabled, variant }: { label: string; onPress: () => void; disabled?: boolean; variant?: 'text' | 'filled' | 'outlined' }) {
  return <Host matchContents={{ vertical: true }} style={styles.host}><Button label={label} onPress={onPress} disabled={disabled} variant={variant ?? 'outlined'} /></Host>;
}

export function OrderScreen({ session, apparatusId, orderId, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<Obj | null>(null);
  const [bootstrap, setBootstrap] = useState<Obj | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [materials, setMaterials] = useState<string[]>([]);
  const [qolips, setQolips] = useState<string[]>([]);
  const [scanner, setScanner] = useState<ScanKind | null>(null);
  const [permission, askPermission] = useCameraPermissions();
  const [selected, setSelected] = useState('');
  const [kg, setKg] = useState('');
  const [meter, setMeter] = useState('');
  const [bobina, setBobina] = useState('');
  const [waste, setWaste] = useState('');
  const [paintColor, setPaintColor] = useState('');
  const [paint, setPaint] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true); setError('');
    try {
      const params = `apparatus=${encodeURIComponent(apparatusId)}&order_id=${encodeURIComponent(orderId)}`;
      const [snapshot, scan] = await Promise.all([
        request(session, `/v1/mobile/admin/production-maps/sequence?worker_scope=true&detail=true&${params}`),
        request(session, `/v1/mobile/admin/production-maps/order-scan-bootstrap?${params}${materials.length ? `&material_barcodes=${encodeURIComponent(materials.join(','))}` : ''}`),
      ]);
      if (version === loadVersion.current) { setDetail(snapshot); setBootstrap(scan); }
    } catch (e) { if (version === loadVersion.current) setError(e instanceof Error ? e.message : 'Buyurtmani yuklab bo‘lmadi'); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, [session, apparatusId, orderId, materials]);
  useEffect(() => { void load(); return () => { loadVersion.current++; }; }, [load, refresh]);

  const control: Obj = bootstrap?.control_state?.control ?? detail?.queue_action_controls?.[apparatusId]?.[orderId] ?? {};
  const interaction: Obj = control.interaction ?? {};
  const allowed: string[] = Array.isArray(control.allowed_actions) ? control.allowed_actions : [];
  const order = detail?.maps?.[0]?.map ?? {};
  const sections: Obj = bootstrap?.sections ?? {};
  const scanningRequired = interaction.start_materials_mode === 'scan_required';
  const qolipRequired = interaction.qolip_mode === 'scan_required';
  const automaticQolip = interaction.qolip_automatic_confirmation === true;
  const materialRequirements: Obj = sections.materials?.data ?? {};
  const requiredQolips: Obj[] = Array.isArray(sections.qolips?.data?.qolip?.required_qolips)
    ? sections.qolips.data.qolip.required_qolips : [];
  const normalizeCode = (value: unknown) => String(value ?? '').trim().toUpperCase();
  const moldSets = new Map<string, Set<string>>();
  const extensions = new Set<string>();
  for (const mold of requiredQolips) {
    const code = normalizeCode(mold.qolip_code);
    if (!code) continue;
    if (mold.is_extension === true) { extensions.add(code); continue; }
    const setId = String(mold.qolip_set_id ?? '').trim() || 'legacy';
    if (!moldSets.has(setId)) moldSets.set(setId, new Set());
    moldSets.get(setId)!.add(code);
  }
  if (!moldSets.size && extensions.size) moldSets.set('extensions', new Set());
  for (const set of moldSets.values()) for (const code of extensions) set.add(code);
  const scannedMolds = new Set(qolips.map(normalizeCode));
  const moldsSatisfied = [...moldSets.values()].some(set => set.size > 0 && set.size === scannedMolds.size && [...set].every(code => scannedMolds.has(code)));

  async function openScanner(kind: ScanKind) {
    const result = permission?.granted ? permission : await askPermission();
    if (!result.granted) { setError('QR skanerlash uchun kamera ruxsati kerak.'); return; }
    setScanner(kind);
  }
  function onScan(value: string) {
    const clean = barcodeFromQr(value);
    if (!clean || !scanner) return;
    setScanner(null);
    const key = normalizeCode(clean);
    if (scanner === 'material') {
      const assigned = Array.isArray(materialRequirements.assigned_barcodes) ? materialRequirements.assigned_barcodes : [];
      if (!assigned.some((code: unknown) => normalizeCode(code) === key)) { setError('Bu material buyurtmaga biriktirilmagan.'); return; }
      setMaterials(old => old.some(code => normalizeCode(code) === key) ? old : [...old, clean]);
    } else {
      const match = requiredQolips.find(mold => normalizeCode(mold.qolip_code) === key);
      if (!match) { setError('Bu qolip buyurtma uchun talab qilinmagan.'); return; }
      const matchesSet = [...moldSets.values()].some(set => set.has(key) && [...scannedMolds].every(code => set.has(code)));
      if (!matchesSet) { setError('Turli qolip to‘plamlarini aralashtirib bo‘lmaydi.'); return; }
      setQolips(old => old.some(code => normalizeCode(code) === key) ? old : [...old, String(match.qolip_code).trim()]);
    }
    setError('');
  }
  async function submit(action: string) {
    if (!allowed.includes(action) || busy) return;
    const isStarting = action === 'start' || action === 'resume';
    if (isStarting && automaticQolip && qolipRequired) { setError('Avtomatik qolip tasdig‘i hozircha qo‘llab-quvvatlanmaydi.'); return; }
    if (isStarting && ((action === 'start' && (interaction.previous_wip_mode === 'scan_required' || interaction.opening_wip_mode === 'scan_required')) || (action === 'resume' && interaction.resume_input_required === true))) { setError('Bu buyurtma uchun kiruvchi rulonni skanerlash talab qilinadi; ushbu oqim hali tayyor emas.'); return; }
    const materialScan = action === 'start' ? scanningRequired : action === 'resume' && interaction.material_scan_required === true;
    if (materialScan) {
      const assigned = Array.isArray(materialRequirements.assigned_barcodes) ? materialRequirements.assigned_barcodes : [];
      if (sections.materials?.status !== 'ready' || materialRequirements.assignments_satisfied !== true || (materialRequirements.requires_material === true && !assigned.length) || (assigned.length > 0 && materialRequirements.scan_satisfied !== true)) { setError('Boshlash uchun serverdagi material talablarini bajaring va kerakli materiallarni skanerlang.'); return; }
    }
    if (isStarting && qolipRequired && (sections.qolips?.status !== 'ready' || !moldsSatisfied)) { setError('Boshlash uchun bitta to‘liq qolip to‘plamini skanerlang.'); return; }
    const needsOutput = action === 'pause' || action === 'roll_complete' || action === 'complete';
    const fields = [kg, meter, bobina];
    if (needsOutput && fields.some(x => !x.trim() || !Number.isFinite(numberValue(x)) || numberValue(x) < 0)) { setError('Metr, vazn va bobina qiymatlarini kiriting.'); return; }
    const paintValues = (usage: string) => Object.fromEntries(paintFields.flatMap(field => {
      const value = paint[`${usage}:${field}`]?.trim();
      return value ? [[field, value.replace(',', '.')]] : [];
    }));
    if (action === 'complete' && (!waste.trim() || !Number.isFinite(numberValue(waste)) || numberValue(waste) < 0 || !paintColor || ['rasxot','astatka'].some(usage => {
      const values = Object.values(paintValues(usage));
      return values.length < 3 || values.some(value => !Number.isFinite(numberValue(value)) || numberValue(value) < 0);
    }))) { setError('Chiqindi, rang va har bir bo‘lim uchun kamida uchta to‘g‘ri bo‘yoq qiymatini kiriting.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      const body: Obj = { apparatus: apparatusId, order_id: orderId, action, include_control: true };
      if (materials.length && materialScan) body.material_barcodes = materials;
      if (qolips.length && (action === 'start' || action === 'resume')) body.qolip_codes = qolips;
      if (needsOutput) Object.assign(body, { finished_goods_kg: numberValue(kg), finished_goods_meter: numberValue(meter), bobina_kg: numberValue(bobina), print_transport: 'offline' });
      if (action === 'complete') Object.assign(body, {
        total_waste: numberValue(waste), full_completion_report_required: true,
        returned_paint_items: ['rasxot', 'astatka'].map(usage => ({ usage, category: 'colors', name: paintColor, values: paintValues(usage) })),
      });
      const result = await request(session, '/v1/mobile/admin/production-maps/queue-action', { method: 'POST', body: JSON.stringify(body) });
      setSelected(''); setMaterials([]); setQolips([]);
      const qr = result.progress_batch?.qr_payload;
      setSuccess(qr ? `Amal bajarildi. Rulon QR: ${qr}` : 'Amal bajarildi.');
      onChanged(); setRefresh(value => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Amal bajarilmadi'); }
    finally { setBusy(false); }
  }
  function confirm(action: string) {
    Alert.alert(actionLabels[action] ?? action, 'Ushbu amal serverga yuboriladi.', [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Tasdiqlash', onPress: () => { void submit(action); } },
    ]);
  }

  if (scanner) return <View style={styles.cameraScreen}><CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13', 'ean8'] }} onBarcodeScanned={({ data }: { data: string }) => onScan(data)} /><Text style={styles.cameraText}>{scanner === 'material' ? 'Material kodini skanerlang' : 'Qolip kodini skanerlang'}</Text><NativeButton label="Bekor qilish" onPress={() => setScanner(null)} /></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <NativeButton label="‹ Navbatga qaytish" variant="text" onPress={onClose} />
    <Text style={styles.eyebrow}>BOSMA · BUYURTMA</Text>
    <Text style={styles.title}>{String(order.title || order.order_number || orderId)}</Text>
    <Text style={styles.muted}>Holat: {String(control.state || bootstrap?.control_state?.queue_state || '—')}</Text>
    {loading && <ActivityIndicator size="large" color="#3157a4" />}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!!success && <Text style={styles.success}>{success}</Text>}
    {!loading && bootstrap && <>
      <View style={styles.card}><Text style={styles.section}>Ishga tayyorgarlik</Text>
        <Text style={styles.muted}>Material: {scanningRequired ? 'skanerlash kerak' : 'skanerlash talab qilinmaydi'}</Text>
        {scanningRequired && <><Text style={styles.small}>{materials.length ? materials.join('\n') : 'Hali skanerlanmagan'}</Text><NativeButton label="Materialni skanerlash" onPress={() => void openScanner('material')} /></>}
        <Text style={styles.muted}>Qolip: {qolipRequired ? 'skanerlash kerak' : 'skanerlash talab qilinmaydi'}</Text>
        {qolipRequired && <><Text style={styles.small}>{qolips.length ? qolips.join('\n') : 'Hali skanerlanmagan'}</Text><NativeButton label="Qolipni skanerlash" onPress={() => void openScanner('qolip')} /><NativeButton label="Qoliplarni qayta skanerlash" variant="text" onPress={() => setQolips([])} /></>}
        {['materials','qolips'].map(k => sections[k]?.status === 'error' ? <Text key={k} style={styles.error}>{k === 'materials' ? 'Material' : 'Qolip'}: {String(sections[k]?.error?.detail || sections[k]?.error?.error || 'ma’lumotni olish imkoni bo‘lmadi')}</Text> : null)}
      </View>
      <View style={styles.card}><Text style={styles.section}>Amallar</Text>
        {allowed.filter(a => actionLabels[a]).map(a => <NativeButton key={a} label={actionLabels[a]} disabled={busy} variant={selected === a ? 'filled' : 'outlined'} onPress={() => { setError(''); setSelected(a); }} />)}
        {!allowed.some(a => actionLabels[a]) && <Text style={styles.muted}>Hozir bajarish mumkin bo‘lgan amal yo‘q.</Text>}
      </View>
      {!!selected && <View style={styles.card}><Text style={styles.section}>{actionLabels[selected]}</Text>
        {['pause','roll_complete','complete'].includes(selected) && <><Field label="Miqdor, metr" keyboardType="decimal-pad" onChangeText={setMeter} /><Field label="Vazn, kg" keyboardType="decimal-pad" onChangeText={setKg} /><Field label="Bobina, kg" keyboardType="decimal-pad" onChangeText={setBobina} /></>}
        {selected === 'complete' && <><Field label="Chiqindi, kg" keyboardType="decimal-pad" onChangeText={setWaste} /><Text style={styles.muted}>Bo‘yoq rangini tanlang va har bir bo‘limda kamida uchta qiymatni kiriting.</Text>{paintColors.map(color => <NativeButton key={color} label={color} variant={paintColor === color ? 'filled' : 'outlined'} onPress={() => { if (paintColor !== color) { setPaint({}); setPaintColor(color); } }} />)}{(['rasxot','astatka'] as const).map(usage => <View key={`${paintColor}:${usage}`}><Text style={styles.section}>{usage === 'rasxot' ? 'Rasxot' : 'Astatka'}</Text>{paintFields.map(key => <Field key={`${usage}:${key}`} label={key} keyboardType="decimal-pad" onChangeText={v => setPaint(old => ({ ...old, [`${usage}:${key}`]: v }))} />)}</View>)}</>}
        <NativeButton label={busy ? 'Yuborilmoqda…' : 'Tasdiqlash'} disabled={busy} variant="filled" onPress={() => confirm(selected)} />
      </View>}
    </>}
    {!loading && <NativeButton label="Yangilash" onPress={() => void load()} disabled={busy} />}
  </ScrollView>;
}
const styles = StyleSheet.create({ screen:{flex:1,backgroundColor:'#f6f8fc'},content:{padding:20,gap:14,paddingBottom:48},host:{width:'100%'},eyebrow:{fontSize:12,fontWeight:'700',color:'#536a94',letterSpacing:1},title:{fontSize:26,fontWeight:'700',color:'#192b4d'},muted:{fontSize:14,color:'#52617a',lineHeight:21},small:{fontSize:13,color:'#52617a',lineHeight:20},section:{fontSize:17,fontWeight:'700',color:'#192b4d',marginBottom:4},card:{backgroundColor:'#fff',borderRadius:18,padding:16,gap:10},field:{gap:3},label:{fontSize:13,color:'#52617a'},error:{color:'#a52626',fontSize:14},success:{color:'#1d7544',fontSize:14},cameraScreen:{flex:1,backgroundColor:'#10182b',justifyContent:'center',padding:16,gap:12},camera:{height:380,borderRadius:18,overflow:'hidden'},cameraText:{color:'#fff',textAlign:'center',fontSize:16}});
