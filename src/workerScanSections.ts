import type { Session } from './auth';
import { sessionReadScope } from './sessionReadScope';
import { WorkerControlException } from './workerControlsApi';
import { preserveWorkerControlProof } from './workerOrderLogic';
import { adminRawMaterialStartRequirements } from './workerRawMaterials';
import { adminProductionMapQolipRequirements } from './workerQolips';

type Obj = Record<string, any>;

/** Re-read only sections that the scoped aggregate did not prove complete. */
export async function completeWorkerScanSections(session: Session, scan: Obj, materialBarcodes: string[]): Promise<Obj> {
  const scope = sessionReadScope(session), state = scan.control_state, interaction = state.control.interaction;
  const sections: Obj = { ...(scan.sections ?? {}) };
  const reads: Promise<void>[] = [];
  if (interaction.start_materials_mode === 'scan_required' && sections.materials?.status !== 'ready') {
    reads.push(adminRawMaterialStartRequirements(session, state.order_id, state.apparatus, materialBarcodes)
      .then(data => { sections.materials = { status: 'ready', data }; })
      .catch(error => { sections.materials = { status: 'error', error: error instanceof Error ? error.message : '', readError: error }; }));
  }
  if (interaction.qolip_mode === 'scan_required' && sections.qolips?.status !== 'ready') {
    const automatic = interaction.qolip_automatic_confirmation === true;
    reads.push(adminProductionMapQolipRequirements(session, state.apparatus, state.order_id, automatic)
      .then(data => {
        if (automatic && (data.automatic_confirmation_enabled !== true || data.policy_revision !== interaction.qolip_policy_revision)) {
          throw new WorkerControlException('qolip_policy_changed', 'Qolip confirmation policy changed');
        }
        sections.qolips = { status: 'ready', data: { ok: true, qolip: data } };
      }).catch(error => { sections.qolips = { status: 'error', error: error instanceof Error ? error.message : '', readError: error }; }));
  }
  await Promise.all(reads);
  if (scope !== sessionReadScope(session)) throw new WorkerControlException('session_scope_changed', '');
  return preserveWorkerControlProof(scan, { ...scan, sections });
}
