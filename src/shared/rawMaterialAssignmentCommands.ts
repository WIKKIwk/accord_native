import { activeSessionToken, type Session } from '../auth';
import { preparationAssignMaterial } from '../preparation/preparationInventoryAssignment';
import { sessionReadScope } from '../sessionReadScope';
import { isCanonicalApparatusId, WorkerControlException } from '../workerControlsApi';
import { appRoutes, canOpenRoute } from './appRoutes';
import { MobileApiException } from './mobileApiException';

type AssignmentChoice = (options: readonly string[]) => Promise<string | null>;
type AssignmentCommandOptions = {
  chooseApparatus: AssignmentChoice;
  cancelledMessage: string;
};

/**
 * Assignment actions are role-neutral. The caller must invalidate isCurrent
 * when its screen, order, code or account lifetime changes: scope alone cannot
 * detect ABA changes. Do not share an instance across account lifetimes.
 */
export class RawMaterialAssignmentCommands {
  private readonly scope: string;
  private busy = false;
  constructor(private readonly session: Session, private readonly isCurrent: () => boolean) {
    this.scope = sessionReadScope(session);
  }

  private assertCurrent() {
    if (!activeSessionToken(this.session) || sessionReadScope(this.session) !== this.scope || !this.isCurrent() ||
        !canOpenRoute(this.session, appRoutes.adminRawMaterialAssignments)) {
      throw new Error('Sessiya o‘zgardi. Qayta urining.');
    }
  }

  private sendOnce(orderId: string, barcode: string, apparatus: string) {
    let attempted = false;
    const beforeSend = () => {
      this.assertCurrent();
      // A received 401 may refresh authentication, but a mutation already
      // attempted must not be repeated automatically. Reload its state first.
      if (attempted) throw new Error('Natijani tekshirib, qayta urinib ko‘ring.');
      attempted = true;
    };
    this.assertCurrent();
    return preparationAssignMaterial(this.session, orderId, barcode, apparatus, beforeSend);
  }

  /** @v2 _assignMaterialWithApparatusSelection */
  async assignScanned(orderId: string, barcode: string, options: AssignmentCommandOptions) {
    if (this.busy) throw new Error('Amal bajarilmoqda.');
    const order = orderId.trim(), code = barcode.trim();
    if (!order || !code) throw new Error('Zakaz tanlang va homashyo QR skaner qiling');
    this.assertCurrent();
    this.busy = true;
    try {
      try {
        const result = await this.sendOnce(order, code, '');
        this.assertCurrent();
        return result;
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
        const result = await this.sendOnce(order, code, apparatus);
        this.assertCurrent();
        return result;
      }
    } finally { this.busy = false; }
  }
}
