import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isSessionWitnessCurrent } from '../auth';
import { useChatMetadata } from '../components/ChatMetadata';
import { useChatRoute } from '../shared/chat/ChatRouteContext';
import { chatUnreadRuntimeFor } from '../shared/chat/chatUnreadRuntime';
import { uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { openAdminProfileChatConversation } from './adminProfileChatApi';
import { adminProfileChatFailureMessage, adminProfileChatTarget } from './adminProfileChatModel';
import type { AdminOwnedRouteProviders } from './AdminOwnedNavigationTypes';

export type AdminProfileChatActionProps = Parameters<NonNullable<AdminOwnedRouteProviders['renderChatAction']>>[0];
const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
/** @v2 _ChatProfileActionButtonState._openChat */
export function useAdminProfileChatAction(props: AdminProfileChatActionProps) {
  const { navigation } = useChatRoute(), { remember } = useChatMetadata(), mounted = useRef(false), opening = useRef(false), pending = useRef(false);
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const [busy, setBusy] = useState(false), target = adminProfileChatTarget(props.session, props.entry);
  const current = useCallback(() => mounted.current && props.isCurrent() && props.witness.session === props.session && isSessionWitnessCurrent(props.witness), [props]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useFocusEffect(useCallback(() => { if (pending.current) { pending.current = false; opening.current = false; setBusy(false); } }, []));
  const open = useCallback(async () => {
    if (!target || opening.current || !props.canInteract() || !current()) return;
    opening.current = true; setBusy(true);
    const guard = () => { if (!current()) throw new Error('Original profile chat session expired'); };
    try {
      const runtime = chatUnreadRuntimeFor(props.session); await runtime.start(); guard();
      const conversation = await openAdminProfileChatConversation(props.session, target, guard); guard();
      await runtime.rememberConversation(conversation); guard(); remember([conversation]); guard();
      pending.current = true; navigation.openConversation(conversation);
    } catch (error) { pending.current = false; if (current()) props.onNotice(adminProfileChatFailureMessage(error)); }
    finally { if (!pending.current) { opening.current = false; if (current()) setBusy(false); } }
  }, [target, props, current, remember, navigation]);
  return { visible: target !== null, busy, label: uiText(busy ? 'Ochilmoqda...' : 'Xabar yozish', locale), open: () => { void open(); } };
}
