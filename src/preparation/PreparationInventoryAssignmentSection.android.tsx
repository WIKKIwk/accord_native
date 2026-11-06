import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { adminApparatus } from '../apparatusApi';
import { activeSessionToken, type Session } from '../auth';
import { adminRawMaterialLookup } from '../rawMaterialLookupApi';
import { adminUnlinkRawMaterialAssignment } from '../rawMaterialUnlinkApi';
import { sessionReadScope } from '../sessionReadScope';
import { preparationAssignMaterial, preparationAssignmentCandidates } from './preparationInventoryAssignment';
import { PreparationButton, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';

type Lookup = Awaited<ReturnType<typeof adminRawMaterialLookup>>;
type Candidate = Awaited<ReturnType<typeof preparationAssignmentCandidates>>[number];
const label = (candidate: Candidate) => [candidate.order.map.order_number || candidate.order.map.code, candidate.order.map.title].filter(Boolean).join(' · ') || candidate.order.map.id;

// @v2 RawMaterialOrderAssignmentSection
export function PreparationInventoryAssignment({ session, barcode, allowAssignment, changed, isCurrent }: {
  session: Session; barcode: string; allowAssignment: boolean; changed: () => Promise<void>; isCurrent: () => boolean;
}) {
  const [state, setState] = useState<{ lookup: Lookup | null; candidates: Candidate[]; loading: boolean; error: string | null }>
    ({ lookup: null, candidates: [], loading: true, error: null });
  const [saving, setSaving] = useState(false), [revision, setRevision] = useState(0);
  const dialogs = usePreparationDialogs(), t = usePreparationText();
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
  const assign = async () => {
    if (saving || !isCurrent() || !allowAssignment) return;
    const id = await dialogs.choose('Buyurtmani tanlang', state.candidates.map(candidate => ({ label: label(candidate),
      subtitle: candidate.order.map.id, value: candidate.order.map.id })), undefined, true);
    const candidate = state.candidates.find(item => item.order.map.id === id);
    if (!candidate || !isCurrent() || !candidate.apparatus_options.length) return;
    let apparatus = candidate.apparatus_options[0];
    if (candidate.apparatus_options.length > 1) {
      const catalog = await adminApparatus(session, { limit: 10000, retryTransient: true }).catch(() => []);
      if (!isCurrent()) return;
      const selected = await dialogs.choose('Apparatni tanlang', candidate.apparatus_options.map(option => ({
        label: catalog.find(item => item.id === option)?.name || option, value: option })), undefined, true);
      if (!selected || !isCurrent()) return;
      apparatus = selected;
    }
    if (!await dialogs.confirm('Buyurtmaga ulash', `${label(candidate)} buyurtmasiga ulansinmi?`, 'Ulash') || !isCurrent()) return;
    setSaving(true);
    try {
      await preparationAssignMaterial(session, candidate.order.map.id, barcode, apparatus, () => {
        if (!isCurrent()) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching');
      });
      if (isCurrent()) { await changed(); retry(); dialogs.message('Buyurtmaga ulash', 'Homashyo buyurtmaga ulandi'); }
    } catch (error) { if (isCurrent()) dialogs.message('Xatolik yuz berdi', error instanceof Error ? error.message : String(error)); }
    finally { if (isCurrent()) setSaving(false); }
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
  return <>
    <PreparationRow title={t('Buyurtma')} subtitle={state.loading ? t('Tekshirilmoqda...') : state.error ? t('Xato')
      : assignment ? [state.lookup?.order?.order_number || state.lookup?.order?.code || assignment.order_id, state.lookup?.order?.title, assignment.apparatus].filter(Boolean).join(' · ') : t('Ulanmagan')} />
    {state.loading ? <ActivityIndicator /> : state.error ? <><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={retry} /></>
      : assignment ? <PreparationButton label="Ulanishni uzish" disabled={saving} onPress={() => void unlink()} />
      : <>{allowAssignment && !state.candidates.length ? <PreparationText>{t('Bu homashyoga mos faol buyurtma topilmadi')}</PreparationText> : null}
        <PreparationButton label="Buyurtmaga ulash" disabled={!allowAssignment || !state.candidates.length || saving} onPress={() => void assign()} /></>}
  </>;
}
