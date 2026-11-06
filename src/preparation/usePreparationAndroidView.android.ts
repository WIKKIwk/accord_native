import type { Session } from '../auth';
import { usePreparationFormula, type PreparationFormulaOptions } from './usePreparationFormula';
import { usePreparationLibrary } from './usePreparationLibrary';
import { usePreparationMaterials } from './usePreparationMaterials';
import { usePreparationVariants, type PreparationVariantsOptions } from './usePreparationVariants';
import type { preparationPendingCommand } from './preparationCommandApi';

export function preparationPendingLabel(pending: NonNullable<Awaited<ReturnType<typeof preparationPendingCommand>>>) {
  if (pending.kind === 'receipts') return `Kirim: ${String(pending.payload.kg ?? '')} kg`;
  if (pending.kind === 'materials') return `Homashyo: ${String(pending.payload.name ?? '')}`;
  return `Order: ${String(pending.payload.order_id ?? '')}`;
}

export function usePreparationMaterialsView(session: Session) {
  const state = usePreparationMaterials(session);
  return { ...state, actionsBlocked: state.loading || state.refreshing || state.saving };
}
export function usePreparationLibraryView(session: Session, mode: 'sets' | 'catalog') {
  const state = usePreparationLibrary(session, mode);
  return { ...state, actionsBlocked: state.loading || state.busy };
}
export function usePreparationFormulaView(session: Session, options: PreparationFormulaOptions) {
  const state = usePreparationFormula(session, options);
  return { ...state, actionsBlocked: state.loading || state.saving || state.deleting || state.openingReceipt };
}
export function usePreparationVariantsView(session: Session, options: PreparationVariantsOptions) {
  const state = usePreparationVariants(session, options);
  return { ...state, actionsBlocked: state.loading || state.creating || state.opening || state.removing || state.copying };
}
