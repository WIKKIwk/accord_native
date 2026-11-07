import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { adminApparatus } from '../apparatusApi';
import { activeSessionToken, type Session } from '../auth';
import { adminRawMaterialLookup } from '../rawMaterialLookupApi';
import { adminUnlinkRawMaterialAssignment } from '../rawMaterialUnlinkApi';
import { sessionReadScope } from '../sessionReadScope';
import { preparationAssignMaterial, preparationAssignmentCandidates } from './preparationInventoryAssignment';
import { PreparationInventoryOrderPicker } from './PreparationInventoryOrderPicker.android';
import { preparationOrderCandidateLabel, type PreparationOrderCandidate } from './preparationOrderCandidateSearch';
import { InventoryDetailRow, InventorySheetButton, InventorySheetNote } from './PreparationInventoryDetails.android';
import { PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';

type Lookup = Awaited<ReturnType<typeof adminRawMaterialLookup>>;
type Candidate = PreparationOrderCandidate;

// @v2 RawMaterialOrderAssignmentSection
export function PreparationInventoryAssignment({ session, barcode, allowAssignment, changed, isCurrent }: {
  session: Session; barcode: string; allowAssignment: boolean; changed: () => Promise<void>; isCurrent: () => boolean;
}) {
  const [state, setState] = useState<{ lookup: Lookup | null; candidates: Candidate[]; loading: boolean; error: string | null }>
    ({ lookup: null, candidates: [], loading: true, error: null });
  const [saving, setSaving] = useState(false), [revision, setRevision] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false), pendingFrame = useRef<number | null>(null), mounted = useRef(true);
  const dialogs = usePreparationDialogs(), t = usePreparationText();
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current); };
  }, []);
  useEffect(() => {
    let active = true;
    const scope = sessionReadScope(session);
    const valid = () => active && isCurrent() && !!activeSessionToken(session) && scope === sessionReadScope(session);
    void (async () => {
      try {
        const lookup = await adminRawMaterialLookup(session, barcode);
        const candidates = !lookup.assignment && allowAssignment ? await preparationAssignmentCandidates(session, barcode) : [];
        if (valid()) setState({ lookup, candidates, loading: false, error: null });
      } catch (error) { if (valid()) setState({ lookup: null, candidates: [], loading: false, error: error instanceof Error ? error.message : String(error) }); }
    })();
    return () => { active = false; };
    // isCurrent reads the active screen scope; its identity is not a request key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, barcode, allowAssignment, revision]);
  const retry = () => { setState({ lookup: null, candidates: [], loading: true, error: null }); setRevision(value => value + 1); };
  const current = () => mounted.current && isCurrent();
  const assign = async (candidate: Candidate) => {
    if (saving || !current() || !allowAssignment) return;
    if (!candidate.apparatus_options.length) return;
    let apparatus = candidate.apparatus_options[0];
    if (candidate.apparatus_options.length > 1) {
      const catalog = await adminApparatus(session, { limit: 10000, retryTransient: true }).catch(() => []);
      if (!current()) return;
      const selected = await dialogs.choose('Apparatni tanlang', candidate.apparatus_options.map(option => ({
        label: catalog.find(item => item.id === option)?.name || option, value: option })), undefined, true);
      if (!selected || !current()) return;
      apparatus = selected;
    }
    if (!await dialogs.confirm('Buyurtmaga ulash', `${preparationOrderCandidateLabel(candidate)} buyurtmasiga ulansinmi?`, 'Ulash') || !current()) return;
    setSaving(true);
    try {
      await preparationAssignMaterial(session, candidate.order.map.id, barcode, apparatus, () => {
        if (!current()) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching');
      });
      if (current()) { await changed(); if (current()) { retry(); dialogs.message('Buyurtmaga ulash', 'Homashyo buyurtmaga ulandi'); } }
    } catch (error) { if (current()) dialogs.message('Xatolik yuz berdi', error instanceof Error ? error.message : String(error)); }
    finally { if (current()) setSaving(false); }
  };
  const selectOrder = (candidate: Candidate) => {
    setPickerOpen(false);
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = null;
      if (current()) void assign(candidate);
    });
  };
  const unlink = async () => {
    const assignment = state.lookup?.assignment;
    if (!assignment || saving || !isCurrent() || !await dialogs.confirm('Homashyoni uzish', 'Bu homashyoni buyurtmadan uzasizmi?', 'Uzish') || !isCurrent()) return;
    setSaving(true);
    try {
      await adminUnlinkRawMaterialAssignment(session, assignment.order_id, assignment.barcode, () => {
        if (!isCurrent()) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching');
      });
      if (isCurrent()) { await changed(); retry(); dialogs.message('Homashyoni uzish', 'Homashyo buyurtmadan uzildi'); }
    } catch (error) { if (isCurrent()) dialogs.message('Xatolik yuz berdi', error instanceof Error ? error.message : String(error)); }
    finally { if (isCurrent()) setSaving(false); }
  };
  const assignment = state.lookup?.assignment;
  return <View style={{ gap: 8 }}>
    <InventoryDetailRow label="Buyurtma" value={state.loading ? t('Tekshirilmoqda...') : state.error ? t('Xato')
      : assignment ? [state.lookup?.order?.order_number || state.lookup?.order?.code || assignment.order_id, state.lookup?.order?.title, assignment.apparatus].filter(Boolean).join(' · ') : t('Ulanmagan')} />
    {state.loading ? null : state.error ? <><PreparationText>{state.error}</PreparationText><InventorySheetButton label="Qayta urinish" kind="outlined" onPress={retry} /></>
      : assignment ? <InventorySheetButton label="Ulanishni uzish" kind="outlined" disabled={saving} onPress={() => void unlink()} />
      : allowAssignment ? state.candidates.length
        ? <InventorySheetButton label="Buyurtmaga ulash" kind="outlined" disabled={saving} onPress={() => { if (current()) setPickerOpen(true); }} />
        : <InventorySheetNote>{t('Bu homashyoga mos faol buyurtma topilmadi')}</InventorySheetNote> : null}
    {pickerOpen ? <PreparationInventoryOrderPicker candidates={state.candidates} onClose={() => setPickerOpen(false)} onSelect={selectOrder} /> : null}
  </View>;
}
