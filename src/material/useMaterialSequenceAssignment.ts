import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { AdminApparatus } from '../apparatusApi';
import { readApparatus } from '../apparatusApi';
import { isSessionWitnessCurrent, sessionWitnessVersion, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { preparationAssignMaterial } from '../preparation/preparationInventoryAssignment';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { adminText, productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { productionMapAuthorizedOrderApparatus } from '../shared/productionMapAuthorizedApparatus';
import { adminRawMaterialAssignmentCandidates, adminRawMaterialAssignmentDiagnostics } from '../shared/rawMaterialAssignmentApi';
import { productionMapResponseError } from '../workerControlsApi';
import { rawMaterialAssignment } from '../workerRawMaterials';
import type { MaterialSequenceOrder } from './materialSequenceModel';
import { materialMapWorkStages } from './materialTaskMapModel';
import { MaterialSequenceAssignmentController } from './materialSequenceAssignmentController';
import { materialSequenceAssignedPresentation, materialSequenceCandidatePresentation, materialSequenceWidthRequirement } from './materialSequenceAssignmentPresentation';

export type MaterialSequenceAssignmentProps = { session: Session; witness: SessionWitness; order: MaterialSequenceOrder;
  initialApparatus: string; apparatusCatalog: readonly AdminApparatus[]; isCurrent(): boolean; onClose(): void };
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const snapshotLocale = () => localeController.locale;

export function useMaterialSequenceAssignment(props: MaterialSequenceAssignmentProps) {
  const { session, witness, order, initialApparatus, apparatusCatalog, isCurrent } = props;
  const locale = useSyncExternalStore(subscribeLocale, snapshotLocale, snapshotLocale);
  useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  const owner = useMemo(() => {
    const current = () => isSessionWitnessCurrent(witness) && isCurrent() && session.profile.role === 'material_taminotchi' &&
      session.token !== 'test-mode-token' && canOpenRoute(session, appRoutes.adminRawMaterialAssignments);
    const guard = () => { if (!current()) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching'); };
    const apparatusOptions = productionMapAuthorizedOrderApparatus(order.map, session.assigned_apparatus);
    return new MaterialSequenceAssignmentController({ current, text: (key, values) => adminText(key, localeController.locale, values),
      candidates: apparatus => adminRawMaterialAssignmentCandidates(session, order.map.id.trim(), apparatus, guard),
      assignments: async apparatus => {
        const query = new URLSearchParams({ order_id: order.map.id.trim(), apparatus });
        guard(); const { response, body } = await readApparatus(session, `/v1/mobile/admin/raw-material-assignments?${query}`, false, undefined, guard); guard();
        const result: unknown = JSON.parse(body);
        if (response.status !== 200) throw productionMapResponseError(response.status, result, 'raw_material_assignments');
        if (!Array.isArray(result)) throw new TypeError('Invalid material assignments');
        return result.map(rawMaterialAssignment);
      },
      diagnostic: (barcode, apparatus) => adminRawMaterialAssignmentDiagnostics(session, barcode, order.map.id.trim(), apparatus, guard),
      assign: (barcode, apparatus) => preparationAssignMaterial(session, order.map.id.trim(), barcode, apparatus, guard),
    }, order.map.id, apparatusOptions, initialApparatus);
  }, [session, witness, order, initialApparatus, isCurrent]);
  useEffect(() => { owner.mount(); return () => owner.unmount(); }, [owner]);
  const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  const t = (key: string, values?: Record<string, unknown>) => adminText(key, locale, values);
  const p = (key: string) => productionText(key, locale);
  const code = order.map.code.trim() || order.map.order_number.trim() || order.map.id.trim();
  const label = `${code} · ${order.map.title.trim() || 'Zakaz'}`, customer = order.map.customer_name.trim();
  return { controller: owner, state, apparatusOptions: owner.apparatusOptions, busy: state.bulkAssigning || !!state.assigningBarcode,
    apparatusLabel: (id: string) => {
      const stage = materialMapWorkStages(order.map).find(row => row.apparatusId === id.trim());
      const node = stage ? order.map.nodes.find(row => row.id === stage.nodeId) : null;
      if (!node) return id.trim();
      return node.kind === 'apparatus' && !node.alternative_group_id.trim() && node.alternative_assigned_title.trim()
        ? node.alternative_assigned_title.trim() : node.title.trim();
    },
    headerSubtitle: [label, customer].filter(Boolean).join(' • '),
    candidates: state.candidates.map((candidate, index) => materialSequenceCandidatePresentation(candidate, index, state, apparatusCatalog, t)),
    assignments: state.assignments.map(row => materialSequenceAssignedPresentation(row, apparatusCatalog, t)),
    widthRequirement: materialSequenceWidthRequirement(order, state.candidates,
      apparatusCatalog.find(row => row.id.trim() === state.selectedApparatus.trim()), t), t, p };
}
