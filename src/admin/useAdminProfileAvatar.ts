import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminProfileAvatarProps } from './AdminProfileAvatarTypes';
import { adminProfileAvatarTitle } from './adminProfileAvatarModel';
import { adminProfileAvatarSession } from './adminProfileAvatarSession';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function useAdminProfileAvatar(props: AdminProfileAvatarProps) {
  const { session, witness, isCurrent, canInteract, avatarUrl, fallbackText, displayName = '', size = 92 } = props;
  const owner = useMemo(() => adminProfileAvatarSession(session, witness, isCurrent), [session, witness, isCurrent]), { controller } = owner;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const mounted = useRef(false), interaction = useRef<{ key: string; canInteract: () => boolean } | null>(null), interactionCheck = useRef<{ reentered: boolean } | null>(null);
  const presentationKey = JSON.stringify([avatarUrl, fallbackText, displayName, size]);
  useLayoutEffect(() => { mounted.current = true; controller.start(); return () => { mounted.current = false; controller.dispose(); }; }, [controller]);
  useLayoutEffect(() => { controller.setUrl(avatarUrl); }, [controller, avatarUrl]);
  useLayoutEffect(() => { interaction.current = { key: presentationKey, canInteract }; return () => { interaction.current = null; }; }, [presentationKey, canInteract]);
  useEffect(() => { const retire = () => { if (!owner.current()) controller.invalidate(); }; const unsubscribe = subscribeSessionWitness(retire); retire(); return unsubscribe; }, [owner, controller]);
  const generation = controller.interactionGeneration;
  const current = useCallback(() => mounted.current && generation === controller.interactionGeneration && controller.isCurrent(), [controller, generation]);
  const interactive = () => {
    if (!current() || interaction.current?.key !== presentationKey || interaction.current.canInteract !== canInteract) return false;
    if (interactionCheck.current) { interactionCheck.current.reentered = true; return false; }
    const frame = { reentered: false }; interactionCheck.current = frame;
    const allowed = isSynchronouslyTrue(canInteract); interactionCheck.current = null;
    return allowed && !frame.reentered && current() && interaction.current?.key === presentationKey && interaction.current.canInteract === canInteract;
  };
  const previewCurrent = (id: number) => current() && controller.getSnapshot().preview?.id === id;
  return { state, size, fallbackText, generation, current, interactive, previewCurrent, namespace: owner.namespace,
    semanticLabel: 'Profil rasmini kattalashtirish', closeLabel: localizedGetter('closeAction', locale),
    open: () => { if (interactive()) controller.open(adminProfileAvatarTitle(displayName, fallbackText)); },
    close: (id: number) => { if (previewCurrent(id)) controller.close(id); },
    imageCurrent: (slot: 'thumbnail' | number, uri: string) => current() && controller.imageCurrent(slot, uri),
    imageFailed: (slot: 'thumbnail' | number, uri: string) => { if (current()) controller.imageFailed(slot, uri); },
  };
}
export type AdminProfileAvatarModel = ReturnType<typeof useAdminProfileAvatar>;
