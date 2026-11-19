import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AccountSwitcher } from './AccountSwitcher';
import { useAccountHome } from './useAccountHome';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const snapshot = () => localeController.locale;

/** @v2 showAccountSwitcherSheet / AppShell._profileButton */
export function useAccountSwitcherLauncher(onProfile?: () => void) {
  const locale = useSyncExternalStore(subscribe, snapshot, snapshot);
  const sheet = useNativeSheet(), goHome = useAccountHome();
  const afterDismiss = useRef<(() => void) | null>(null);
  const finish = (action: () => void) => {
    if (!sheet.isOpen()) { action(); return; }
    afterDismiss.current = action;
    sheet.close();
  };
  const open = () => {
    if (sheet.isOpen()) return;
    sheet.open(<AccountSwitcher onEmpty={sheet.close}
      onSwitched={(session: Session) => finish(() => goHome(session))}
      onAddAccount={() => finish(() => router.push('/add-account'))} />, {
      fitContent: true, heightFraction: 0.65, dismissible: true,
      onDismiss: () => { const action = afterDismiss.current; afterDismiss.current = null; action?.(); },
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };
  return { open, hint: localizedGetter('accountSwitchHint', locale),
    // Keep a short tap from opening a second screen while the chooser is active.
    onPress: () => { if (!sheet.isOpen()) onProfile?.(); } };
}
