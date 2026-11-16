import { useCallback, useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import { createAdminItemDetailDecisionSession } from './adminItemDetailDecisionSession';
import type { AdminItemDetailReadContext, AdminItemDetailReadProps } from './AdminItemDetailReadTypes';
import { adminItemDetailReadPresentation } from './AdminItemDetailReadPresentation';
import { AdminItemDetailReadLifecycle } from './AdminItemDetailReadLifecycle';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function useAdminItemDetailRead(props: AdminItemDetailReadProps) {
  const { session, witness, pageIdentity, isCurrent, onBack, presentations } = props;
  // One genuine page identity captures the Source initState arguments and original authority.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const original = useMemo(() => ({ pageIdentity, session, witness, isCurrent, itemCode: props.itemCode }), [pageIdentity]);
  const owner = useMemo(() => createAdminItemDetailDecisionSession(original.session, original.witness, original.isCurrent, original.itemCode), [original]);
  const sameArguments = original.session === session && original.witness === witness && original.isCurrent === isCurrent;
  const controller = owner.controller, lifecycle = useMemo(() => new AdminItemDetailReadLifecycle(owner), [owner]), state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale), interaction = useMemo(() => createProfileSessionGuard(props.canInteract), [props.canInteract]);
  const nativeCallbacks = useMemo(() => ({ interaction, presentations, onBack }), [interaction, presentations, onBack]);
  useLayoutEffect(() => lifecycle.commitInteraction(nativeCallbacks), [lifecycle, nativeCallbacks]);
  useLayoutEffect(() => lifecycle.attach(() => controller.start(), () => controller.dispose()), [controller, lifecycle]);
  useLayoutEffect(() => { if (!sameArguments) controller.invalidate(); }, [sameArguments, controller]);
  useEffect(() => { const check = () => { if (!owner.current()) controller.invalidate(); }; const stop = subscribeSessionWitness(check); check(); return stop; }, [owner, controller]);
  const generation = controller.interactionGeneration;
  const current = useCallback(() => lifecycle.current() && sameArguments && owner.current() && controller.isCurrent(generation), [lifecycle, sameArguments, owner, controller, generation]);
  const canInteract = useCallback(() => lifecycle.current() && current() && lifecycle.ownsInteraction(nativeCallbacks) && nativeCallbacks.interaction() && lifecycle.current() && current() && lifecycle.ownsInteraction(nativeCallbacks), [lifecycle, current, nativeCallbacks]);
  const context: AdminItemDetailReadContext = useMemo(() => Object.freeze({ session: original.session, witness: original.witness, controller, generation, isCurrent: current, canInteract }), [original, controller, generation, current, canInteract]);
  const a = useCallback((key: string, values?: Record<string, unknown>) => adminText(key, locale, values), [locale]), t = useCallback((key: string) => localizedGetter(key, locale), [locale]);
  const presentation = state.detail ? adminItemDetailReadPresentation(state.detail, state, a) : null;
  const dispatch = useCallback((action: 'edit' | 'group' | 'delete' | 'actions') => {
    if (!canInteract() || !state.detail || controller.getSnapshot().phase !== 'content' || controller.getSnapshot().detail !== state.detail) return;
    if (action === 'edit') controller.requestEdit(state.detail); else if (action === 'group') void controller.requestGroup(state.detail);
    else if (action === 'delete') controller.requestDelete(state.detail);
    else if (presentation?.kind !== 'ordinary') presentations.onActions(context, state.detail, presentation!.kind);
  }, [canInteract, controller, state, presentation, presentations, context]);
  const back = useCallback(() => { if (canInteract()) onBack(controller.getSnapshot().changed); }, [canInteract, onBack, controller]);
  const retry = useCallback(() => { if (canInteract()) void controller.reload(); }, [canInteract, controller]);
  return { owner, controller, state, generation, current, canInteract, context, presentation, a, t, locale, back, retry, dispatch };
}
export type AdminItemDetailReadModel = ReturnType<typeof useAdminItemDetailRead>;
