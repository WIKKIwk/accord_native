import { StorageList, StoragePickerConfirm, StorageSelectionStrip, StorageScannerManual } from './QolipStorageNative';
import { createQolipStorageBinding } from './qolipStorageBinding';
import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Animated, AppState, BackHandler, Easing, Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { CameraSurface } from '../shared/camera/CameraSurface';
import { QolipStoragePickerState } from './qolipStoragePickerState';
import { qolipStorageMolds, type QolipStorageMold } from './qolipStorageApi';
import { qolipStorageMoldStatus } from './qolipStoragePresentation';
import type { StorageRow } from './qolipStorageViewProps';
import { useQolipStorageImages } from './useQolipStorageImages';
import { useQolipStorageDialogs } from './useQolipStorageDialogs';
import { useQolipQrCamera } from './useQolipQrCamera';
import { useQolipRole } from './QolipRoleContext';
import { useQolipPresentation } from './useQolipPresentation';
import { QolipStorageMoldDetails } from './QolipStorageMoldDetails';
import { useIsFocused, useNavigation, usePreventRemove } from 'expo-router';
import { QolipPickerDock } from './QolipPickerDock';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { productionText } from '../shared/localization';
import { useQolipText } from './useQolipText';
import { trimDart } from './qolipApiCommon';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';

/** @v2 _MoldPicker */
export function QolipStorageMoldPicker({ warehouse, paddonCode, scanInitially = false, close }: {
  warehouse?: string; paddonCode?: string; scanInitially?: boolean; close(value: readonly QolipStorageMold[] | null): void;
}) {
  const role = useQolipRole(), dialogs = useQolipStorageDialogs();
  const binding = useMemo(() => createQolipStorageBinding({ dialogs }), [role.session, role.boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { binding.update({ dialogs }); });
  const [feedback, setFeedback] = useState<{ text: string; tone: 'accepted' | 'rejected' | null }>({ text: '', tone: null }), [foreground, setForeground] = useState(AppState.currentState === 'active'), [allowExit, setAllowExit] = useState(false);
  const focused = useIsFocused(), navigation = useNavigation();
  const owner = useMemo(() => new QolipStoragePickerState(warehouse, paddonCode, scanInitially, {
    current: role.isCurrent,
    read: (input, guard) => qolipStorageMolds(role.session, input, guard),
    notice: (key, code, detail) => setFeedback({ text: `${code ? `${code} — ` : ''}${binding.read().dialogs.text(key)}${detail ? `: ${detail}` : ''}`, tone: key === 'scan_accepted' ? 'accepted' : key === 'duplicate' ? null : 'rejected' }),
    confirmDiscard: count => binding.read().dialogs.confirm(binding.read().dialogs.text('leave'), `${binding.read().dialogs.text('selected')}: ${count}`),
  }), [role.session, role.isCurrent, warehouse, paddonCode, scanInitially, binding]);
  useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  const colors = useWorkerColors(), details = useQolipPresentation();
  const camera = useQolipQrCamera(owner.scanMode && foreground && focused && !owner.reviewing, owner.current), t = dialogs.text;
  const restartCamera = camera.restart, { locale } = useQolipText();
  const [manualVisible, setManualVisible] = useState(false), [manualValue, setManualValue] = useState(''), [detecting, setDetecting] = useState(0);
  const scannerLive = useMemo(() => createQolipStorageBinding({ mounted: true, activeDetections: 0, last: '', generation: 0 }), [owner]); // eslint-disable-line react-hooks/exhaustive-deps -- Scanner state must retire with this picker owner.
  const cardColor = useMemo(() => new Animated.Value(0), []);
  useEffect(() => { const state = scannerLive.read(); state.mounted = true; return () => { state.mounted = false; }; }, [scannerLive]);
  useEffect(() => {
    if (feedback.tone === null) return;
    const timer = setTimeout(() => setFeedback(previous => previous === feedback ? { ...previous, tone: null } : previous), 2_000);
    return () => clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    const animation = Animated.timing(cardColor, { toValue: feedback.tone === 'accepted' ? 1 : feedback.tone === 'rejected' ? 2 : 0, duration: feedback.tone === null ? 2_000 : 0, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(); return () => animation.stop();
  }, [cardColor, feedback.tone]);
  const detect = async (raw: string, manual = false) => {
    const state = scannerLive.read(), value = trimDart(raw);
    if (!owner.current() || !owner.scanMode || owner.reviewing || !value || (manual && (state.activeDetections > 0 || owner.busy))) return;
    if (state.generation !== camera.generation) { state.generation = camera.generation; state.last = ''; }
    // mobile_scanner noDuplicates retains the last non-empty capture, even across empty frames.
    if (!manual && state.last === value) return;
    if (!manual) { state.last = value; void impactAsync(ImpactFeedbackStyle.Medium).catch(() => {}); }
    state.activeDetections++; setDetecting(state.activeDetections);
    try { await owner.scan(value); if (manual && state.mounted) setManualValue(''); }
    finally { state.activeDetections = Math.max(0, state.activeDetections - 1); if (state.mounted) setDetecting(state.activeDetections); }
  };
  const scannerBusy = detecting > 0 || owner.pendingScans > 0;
  const scannerText = scannerBusy ? productionText('worker.scanner.checking', locale) : feedback.text || t('scan_ready');
  useEffect(() => { if (owner.listVisible) void owner.load(); return () => owner.dispose(); }, [owner]);
  useEffect(() => { const listener = AppState.addEventListener('change', state => setForeground(state === 'active')); return () => listener.remove(); }, []);
  useEffect(() => { if (owner.scanMode && foreground && focused && !owner.reviewing) void restartCamera(); }, [owner, owner.scanMode, owner.reviewing, foreground, focused, restartCamera]);
  const leave = async () => { if (await owner.leave()) { setAllowExit(true); requestAnimationFrame(() => close(null)); } };
  usePreventRemove(!allowExit && owner.current() && (owner.selected.size > 0 || owner.busy), ({ data }) => {
    void owner.leave().then(confirmed => { if (confirmed) { setAllowExit(true); requestAnimationFrame(() => navigation.dispatch(data.action)); } });
  });
  useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { void leave(); return true; }); return () => listener.remove(); });
  const groups = owner.groups(), images = useQolipStorageImages(owner.listVisible ? groups : []), rows: StorageRow[] = [];
  const review = (mold: QolipStorageMold) => {
    if (!owner.current() || owner.busy || owner.reviewing) return;
    setManualVisible(false); setManualValue(''); scannerLive.read().last = '';
    owner.setReviewing(true);
    details.open(<QolipStorageMoldDetails mold={mold} />, { dismissible: true, heightFraction: 0.86,
      onDismiss: () => { owner.setReviewing(false); } });
  };
  if (owner.inline || owner.scanMode) {
    const selected = owner.inline ? [...owner.scanned].reverse().map(key => owner.selected.get(key)!).filter(Boolean) : [...owner.selected.values()];
    if (selected.length || !owner.inline) rows.push({ id: 'selection-heading', section: true, title: `${t('selection_review')} (${selected.length})` });
    if (!selected.length && !owner.inline) rows.push({ id: 'selection-empty', title: t('selected_empty'), subtitle: t('scan_ready') });
    for (const mold of selected) rows.push({ id: `selected:${mold.code}`, title: mold.code,
      subtitle: `${mold.product_names}\n${t('set')}: ${mold.set_id}`, selected: true,
      onPress: () => review(mold), onSelect: () => owner.toggle(mold, false), disabled: owner.loadingProduct !== null });
  }
  if (owner.listVisible) rows.push({ id: 'loaded-heading', section: true, title: `${t('loaded_products')} (${groups.length})` });
  if (owner.listVisible) for (const group of groups) {
    rows.push({ id: group.key, title: group.unlinked ? t('unlinked_molds') : group.name || group.code,
      subtitle: group.code, imageOrderId: images[group.key], selected: owner.productSelection(group),
      onPress: () => { void owner.expand(group); }, onSelect: () => { void owner.toggleProduct(group); }, disabled: owner.busy || owner.listPending });
    if (owner.expanded.has(group.key)) {
      const molds = owner.products.get(group.key) ?? owner.molds.filter(mold => group.visibleMolds.includes(mold));
      const byCode = new Map(molds.filter(mold => owner.eligible(mold)).map(mold => [mold.code.trim().toLowerCase(), mold]));
      for (const [key, mold] of byCode) {
        const status = qolipStorageMoldStatus(mold, warehouse);
        rows.push({ id: `${group.key}:${key}`, title: mold.code, subtitle: [group.unlinked ? mold.name : '', mold.size > 0 ? mold.size : '', t(status.key)].filter(Boolean).join(' • '),
          selected: owner.selected.has(key), onPress: () => owner.toggle(mold), onSelect: () => owner.toggle(mold), disabled: owner.busy || owner.listPending,
          trailing: { label: t('mold_details'), onPress: () => review(mold) } });
      }
      if (owner.productErrors.has(group.key)) rows.push({ id: `${group.key}:error`, title: t('failed'), onPress: () => { void owner.loadProduct(group); } });
    }
  }
  const finish = () => { const result = owner.finish(); if (result) { setAllowExit(true); requestAnimationFrame(() => close(result)); } };
  return <View style={{ flex: 1 }}>
    <StorageList rows={rows} query={owner.listVisible ? owner.query : undefined} onQuery={owner.listVisible ? value => owner.setQuery(value) : undefined}
      title={t('select_molds')} onBack={() => { void leave(); }}
      searchEnabled={!owner.busy}
      searchHint={t('search')} loading={owner.loading} onViewport={after => { if ((groups.length === 0 || after < 240) && owner.next !== null) void owner.load(true); }}
      header={<>
        {!!paddonCode && <Text style={{ color: colors.text }}>{paddonCode}</Text>}{!!warehouse && <Text style={{ color: colors.text }}>{warehouse}</Text>}
        {owner.listVisible && <Text style={{ color: colors.text }}>{t('picker_hint')}</Text>}
        <Text style={{ color: colors.text }}>{`${t('selected')}: ${owner.selected.size}`}</Text>
        <WorkerSheetButton label={owner.inline ? t('scan_via_qr') : t(owner.scanMode ? 'list_mode' : 'scan_mode')} disabled={owner.reviewing || owner.loadingProduct !== null}
          onPress={() => { setFeedback({ text: '', tone: null }); setManualVisible(false); setManualValue(''); scannerLive.read().last = ''; owner.changeMode(!owner.scanMode); }} />
        {owner.scanMode && !owner.reviewing && <Animated.View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: cardColor.interpolate({ inputRange: [0, 1, 2], outputRange: [colors.surface, '#CBFEBC', '#F23544'] }) }}>
          <View style={{ height: 248, alignItems: 'center', paddingTop: 12 }}>
            <View style={{ width: '100%', maxWidth: 218, aspectRatio: 1, backgroundColor: colors.field, borderRadius: 24, overflow: 'hidden' }}>
              <CameraSurface active={camera.requested && foreground} permission={camera.permission} checking={camera.checking} facing="back" torch={false}
                barcodeTypes={['qr', 'datamatrix']} sessionKey={String(camera.generation)} isCurrent={camera.canUseCamera} cameraRef={camera.cameraRef}
                style={{ flex: 1 }} onReady={() => camera.onReady(camera.generation)} onMountError={() => camera.onMountError(camera.generation)}
                onDetection={event => { void detect(event.data); }} />
              {camera.ready && <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}><Svg width="100%" height="100%" viewBox="0 0 218 218">
                <Rect x={0.6} y={0.6} width={216.8} height={216.8} rx={24} stroke="#ffffff57" strokeWidth={1.2} fill="none" />
                {[1 / 3, 2 / 3].map(point => <Line key={`v${point}`} x1={218 * point} x2={218 * point} y1={0} y2={218} stroke="#ffffff85" strokeWidth={1.2} />)}
                {[1 / 3, 2 / 3].map(point => <Line key={`h${point}`} y1={218 * point} y2={218 * point} x1={0} x2={218} stroke="#ffffff85" strokeWidth={1.2} />)}
                <Path d="M2.5 52V26.5A24 24 0 0 1 26.5 2.5H52 M166 2.5H191.5A24 24 0 0 1 215.5 26.5V52 M215.5 166V191.5A24 24 0 0 1 191.5 215.5H166 M52 215.5H26.5A24 24 0 0 1 2.5 191.5V166" stroke="#fff" strokeWidth={5} strokeLinecap="round" fill="none" />
              </Svg></View>}
              {camera.ready ? <View pointerEvents="none" style={{ position: 'absolute', bottom: 12, left: 8, right: 8, borderRadius: 14, backgroundColor: '#0009', padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {scannerBusy && <ActivityIndicator size="small" color="#fff" />}<Text style={{ color: '#fff', flexShrink: 1, textAlign: 'center', fontSize: 12 }}>{scannerText}</Text>
              </View> : <View style={{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: camera.failure ? '#000' : colors.field }}>
                {camera.failure ? <Text style={{ color: '#fff', padding: 20, textAlign: 'center' }}>{productionText('worker.scanner.unavailable', locale)}</Text> : <SymbolView name={{ android: 'qr_code_scanner', ios: 'qrcode.viewfinder' }} size={44} tintColor={colors.icon} />}
              </View>}
            </View>
            <View style={{ position: 'absolute', right: 8, bottom: 8, borderRadius: 24, backgroundColor: colors.field }}>
              <WorkerIconButton icon={manualVisible ? 'close' : 'edit'} label={productionText(manualVisible ? 'worker.scanner.manual.hide' : 'worker.scanner.manual.show', locale)} tonal onPress={() => setManualVisible(value => !value)} />
            </View>
          </View>
          {manualVisible && <StorageScannerManual value={manualValue} busy={scannerBusy} label={productionText('worker.scanner.manual.label', locale)} acceptLabel={productionText('worker.scanner.accept', locale)} change={setManualValue} submit={() => { void detect(manualValue, true); }} />}
        </Animated.View>}
        {owner.scanMode && <>{!!feedback.text && <Text style={{ color: feedback.tone === 'rejected' ? colors.error : colors.text }}>{feedback.text}</Text>}
          {owner.pendingScans > 0 && <Text style={{ color: colors.text }}>{t('scan_pending')}</Text>}
          </>}
        {owner.listVisible && <StorageSelectionStrip codes={[...owner.selected.values()].map(mold => mold.code)} empty={t('selected_empty')} disabled={owner.busy} remove={code => { const mold = owner.selected.get(code.trim().toLowerCase()); if (mold) owner.toggle(mold, false); }} />}
        {!!owner.error && <WorkerSheetButton label={t('failed')} onPress={() => { void owner.load(owner.moreFailure); }} />}
      </>}
      footer={!owner.loading && !owner.error && owner.listVisible && !groups.length && owner.next === null ? <Text style={{ color: colors.text }}>{t('empty')}</Text> : undefined} />
    <View style={{ position: 'absolute', bottom: 110, right: 16, maxWidth: '90%' }}><StoragePickerConfirm label={`${t('confirm')} (${owner.selected.size})`} disabled={!owner.canFinish} onPress={finish} /></View>
    <QolipPickerDock beforeNavigate={async () => {
      if (!await owner.leave()) return false;
      setAllowExit(true); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); return true;
    }} />
    {dialogs.overlays}
  </View>;
}
