import { activeSessionToken, type Session } from '../auth';
import { preparationAssignMaterial } from '../preparation/preparationInventoryAssignment';
import { adminUnlinkRawMaterialAssignment } from '../rawMaterialUnlinkApi';
import { sessionReadScope } from '../sessionReadScope';
import { isCanonicalApparatusId, WorkerControlException } from '../workerControlsApi';
import type { AdminRawMaterialAssignment } from '../workerRawMaterials';
import { appRoutes, canOpenRoute } from './appRoutes';
import { isSynchronouslyTrue } from './camera/synchronousGuard';
import { MobileApiException } from './mobileApiException';
import type { RawMaterialAssignmentCandidate } from './rawMaterialAssignmentApi';

type AssignmentChoice = (options: readonly string[]) => Promise<string | null>;
type AssignmentCommandOptions = {
  chooseApparatus: AssignmentChoice;
  cancelledMessage: string;
};
type UnlinkSource = { kind: 'manual' } | { kind: 'scan'; detailStatus: string };

/** @v2 _scannedRawMaterialCanBeUnlinked */
export function rawMaterialAssignmentCanUnlink(assignment: AdminRawMaterialAssignment, source: UnlinkSource): boolean {
  if (source.kind === 'scan' && assignment.consumed_qty > 0) return false;
  const assignmentStatus = assignment.stock_status.trim().toLowerCase();
  const status = assignmentStatus || (source.kind === 'scan' ? source.detailStatus.trim().toLowerCase() : '');
  return status === '' || status === 'available';
}

/**
 * Assignment actions are role-neutral. The caller must invalidate isCurrent
 * when its screen, order, code or account lifetime changes: scope alone cannot
 * detect ABA changes. Do not share an instance across account lifetimes.
 */
export class RawMaterialAssignmentCommands {
  private readonly scope: string;
  private busy = false;
  private reconciliationRequired = false;
  constructor(private readonly session: Session, private readonly isCurrent: () => boolean) {
    this.scope = sessionReadScope(session);
  }

  get needsReconciliation(): boolean { return this.reconciliationRequired; }

  private assertCurrent() {
    const token = activeSessionToken(this.session);
    const allowed = () => sessionReadScope(this.session) === this.scope && canOpenRoute(this.session, appRoutes.adminRawMaterialAssignments);
    if (!token || !allowed() || !isSynchronouslyTrue(this.isCurrent) || activeSessionToken(this.session) !== token || !allowed()) {
      throw new Error('Sessiya o‘zgardi. Qayta urining.');
    }
  }

  private sendOnce<T>(send: (beforeSend: () => void) => Promise<T>, allowDefiniteAmbiguity = false): Promise<T> {
    let attempted = false;
    const beforeSend = () => {
      this.assertCurrent();
      // A received 401 may refresh authentication, but a mutation already
      // attempted must not be repeated automatically. A refresh alone cannot
      // prove a timed-out server operation will not commit later.
      if (attempted) throw new Error('Oldingi amal natijasi noaniq. Qayta yuborish bloklandi.');
      attempted = true;
    };
    this.assertCurrent();
    return send(beforeSend).catch(error => {
      const definiteAmbiguity = allowDefiniteAmbiguity && error instanceof WorkerControlException && error.statusCode === 400 &&
        error.code === 'raw_material_group_ambiguous';
      if (attempted && !definiteAmbiguity) this.reconciliationRequired = true;
      throw error;
    });
  }

  private assignOnce(orderId: string, barcode: string, apparatus: string) {
    return this.sendOnce(guard => preparationAssignMaterial(this.session, orderId, barcode, apparatus, guard), true);
  }

  private currentResult<T>(value: T): T {
    try { this.assertCurrent(); return value; }
    catch (error) { this.reconciliationRequired = true; throw error; }
  }

  private async exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('Amal bajarilmoqda.');
    if (this.reconciliationRequired) throw new Error('Oldingi amal natijasi noaniq. Qayta yuborish bloklandi.');
    this.assertCurrent();
    this.busy = true;
    try { return await action(); } finally { this.busy = false; }
  }

  /** @v2 _assignMaterialWithApparatusSelection */
  async assignScanned(orderId: string, barcode: string, options: AssignmentCommandOptions) {
    const order = orderId.trim(), code = barcode.trim();
    if (!order || !code) throw new Error('Zakaz tanlang va homashyo QR skaner qiling');
    return this.exclusive(async () => {
      try {
        return this.currentResult(await this.assignOnce(order, code, ''));
      } catch (error) {
        this.assertCurrent();
        // Only a definite bad-request rejection explicitly identifying the
        // ambiguity may lead to a user-chosen second command. Network, timeout,
        // 5xx and malformed-success outcomes can be uncertain and are not retried.
        if (!(error instanceof WorkerControlException) || error.statusCode !== 400 || error.code !== 'raw_material_group_ambiguous') throw error;
        const raw = error.diagnostics.apparatus_options;
        const choices = Array.isArray(raw) ? raw.map(value => String(value).trim()).filter(Boolean) : [];
        if (!choices.length) throw error;
        const allowed = new Set(choices), selected = await options.chooseApparatus(Object.freeze([...choices]));
        this.assertCurrent();
        if (selected == null) throw new MobileApiException({ code: 'raw_material_assignment_cancelled', message: options.cancelledMessage });
        const apparatus = typeof selected === 'string' ? selected.trim() : '';
        if (!allowed.has(apparatus) || !isCanonicalApparatusId(apparatus)) throw new TypeError('Invalid apparatus choice');
        return this.currentResult(await this.assignOnce(order, code, apparatus));
      }
    });
  }

  /** @v2 _openManualCandidate */
  async assignCandidate(orderId: string, candidate: RawMaterialAssignmentCandidate,
    confirm: () => Promise<boolean>, chooseApparatus: AssignmentChoice) {
    const order = orderId.trim(), code = candidate.barcode.trim(), choices = Object.freeze([...candidate.apparatus_options]);
    if (!order || !code) throw new Error('Zakaz tanlang va homashyo QR skaner qiling');
    return this.exclusive(async () => {
      const confirmed = await confirm();
      this.assertCurrent();
      if (!confirmed) return null;
      const selected = choices.length === 1 ? choices[0] : await chooseApparatus(choices);
      this.assertCurrent();
      if (selected == null) return null;
      const apparatus = typeof selected === 'string' ? selected.trim() : '';
      if (!choices.includes(apparatus) || !isCanonicalApparatusId(apparatus)) throw new TypeError('Invalid apparatus choice');
      return this.currentResult(await this.assignOnce(order, code, apparatus));
    });
  }

  /** @v2 _unlink */
  async unlink(assignment: AdminRawMaterialAssignment, source: UnlinkSource, confirm: () => Promise<boolean>) {
    const order = assignment.order_id.trim(), code = assignment.barcode.trim();
    if (!order || !code || !rawMaterialAssignmentCanUnlink(assignment, source)) throw new Error('Homashyoni uzib bo‘lmaydi.');
    return this.exclusive(async () => {
      const confirmed = await confirm();
      this.assertCurrent();
      if (!confirmed) return null;
      const result = await this.sendOnce(guard => adminUnlinkRawMaterialAssignment(this.session, order, code, guard));
      return this.currentResult(result);
    });
  }
}
