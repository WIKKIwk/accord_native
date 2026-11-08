import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { activeSessionEpoch, activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

type ActionId = 'tasks' | 'receipt' | 'scan' | 'assignment' | 'movement';
export type MaterialHomeHandlers = {
  /** The consumer owns the active screen/interaction lifetime and must use reviewed destinations. */
  isCurrent: () => boolean;
  tasks?: () => void;
  receipt?: () => void;
  scan?: () => void;
  assignment?: () => void;
  movement?: () => void;
  showMissingGroup?: () => void;
};
export type MaterialHomeAction = Readonly<{ id: ActionId; label: string; icon: Readonly<{ ios: SFSymbol; android: AndroidSymbol }>; width: number }>;

type Candidate = MaterialHomeAction & Readonly<{ route: string; groupRequired: boolean; handler?: () => void }>;

/** @v2 _materialHomeActions / _materialFabActions; no destinations are installed here. */
export function materialHomeActions(session: Session, handlers?: MaterialHomeHandlers): {
  cards: readonly MaterialHomeAction[]; fab: readonly MaterialHomeAction[]; select: (id: string) => void;
} {
  const empty = { cards: [], fab: [], select: () => {} };
  if (!handlers || typeof handlers.isCurrent !== 'function') return empty;
  const { isCurrent, showMissingGroup, tasks, receipt, scan, assignment, movement } = handlers;
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session);
  const allowed = () => session.profile.role === 'material_taminotchi' && sessionReadScope(session) === scope;
  const current = () => {
    try { return epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && allowed() && isSynchronouslyTrue(isCurrent) &&
      activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && allowed(); } catch { return false; }
  };
  if (!current()) return empty;
  const candidates: readonly Candidate[] = [
    { id: 'tasks', label: 'Vazifalar', icon: { ios: 'checklist', android: 'assignment' }, width: 175,
      route: appRoutes.materialTasks, groupRequired: false, handler: tasks },
    { id: 'receipt', label: 'Kirim', icon: { ios: 'scalemass', android: 'scale' }, width: 150,
      route: appRoutes.gscaleMode, groupRequired: false, handler: receipt },
    { id: 'scan', label: 'QR skanerlash', icon: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' }, width: 215,
      route: appRoutes.adminRawMaterialAssignments, groupRequired: true, handler: scan },
    { id: 'assignment', label: 'Homashyo biriktirish', icon: { ios: 'shippingbox', android: 'inventory_2' }, width: 260,
      route: appRoutes.adminRawMaterialAssignments, groupRequired: true, handler: assignment },
    { id: 'movement', label: 'Joylashtirish va transfer', icon: { ios: 'arrow.left.arrow.right', android: 'swap_horiz' }, width: 290,
      route: appRoutes.inventoryMovements, groupRequired: false, handler: movement },
  ];
  const available = candidates.filter(item => typeof item.handler === 'function' &&
    (!item.groupRequired || typeof showMissingGroup === 'function') && canOpenRoute(session, item.route));
  const view = (item: Candidate): MaterialHomeAction => ({ id: item.id, label: item.label, icon: item.icon, width: item.width });
  const cards = available.filter(item => item.id !== 'scan').map(view), fab = available.filter(item => item.id !== 'tasks').map(view);
  const select = (id: string) => {
    const item = available.find(action => action.id === id);
    if (!item || !current() || !canOpenRoute(session, item.route)) return;
    if (item.groupRequired && !session.assigned_item_groups?.length) { showMissingGroup?.(); return; }
    if (current() && canOpenRoute(session, item.route)) item.handler?.();
  };
  return { cards, fab, select };
}
