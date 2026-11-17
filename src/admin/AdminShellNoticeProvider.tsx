import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { Session } from '../auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useAdminShell } from './AdminShellContext';
import { useAdminShellSourceWindowLayout } from './AdminShellSourceWindowLayoutContext';
import { AdminTopNoticeHost } from './AdminTopNoticeHost';
import { AdminTopNoticeProvider } from './AdminTopNoticeProvider';
import type { AdminTopNoticeIcon, AdminTopNoticeTone } from './adminTopNoticeModel';
import { createAdminTopNoticeSession } from './adminTopNoticeSession';
import { useAdminTopNoticeScaffold } from './useAdminTopNoticeScaffold';

const Context = createContext<ReturnType<typeof createAdminTopNoticeSession> | null>(null);
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

/** One original account Messenger surrounds all genuine Admin stack scenes. */
export function AdminShellNoticeProvider({ children, mayEnter }: { children: ReactNode; mayEnter?: (session: Session | null) => boolean }) {
  const shell = useAdminShell();
  const owner = useMemo(() => createAdminTopNoticeSession({ session: shell.session, witness: shell.witness, isCurrent: shell.isCurrent, mayEnter }),
    [shell.session, shell.witness, shell.isCurrent, mayEnter]);
  const [accessibleNavigation, setAccessibleNavigation] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true, revision = 0;
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', enabled => {
      revision++; if (mounted) setAccessibleNavigation(enabled);
    });
    const started = revision;
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => {
      if (mounted && revision === started) setAccessibleNavigation(enabled);
    }).catch(() => { /* Do not invent native accessibility facts if initialization fails. */ });
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return <Context.Provider value={owner}><AdminTopNoticeProvider messenger={owner.messenger} accessibleNavigation={accessibleNavigation} retainChildrenWhileUnresolved>
    {children}
  </AdminTopNoticeProvider></Context.Provider>;
}

/** Each actual Source AppShell is a sibling Scaffold, including pushed native routes. */
export function useAdminShellNotice() {
  const owner = useContext(Context);
  if (!owner) throw new Error('The original Admin notice session is required');
  const scaffold = useAdminTopNoticeScaffold(null), sourceWindow = useAdminShellSourceWindowLayout(), safe = useSafeAreaInsets();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const insets = sourceWindow ? sourceWindow.safeInsets : safe;
  const inlineInsets = insets ? { left: insets.left, right: insets.right } : null;
  return {
    showTopNotice: (message: string, tone: AdminTopNoticeTone, icon?: AdminTopNoticeIcon) => { owner.show({ message, tone, icon }); },
    onErrorNotice: (message: string) => { owner.show({ message, tone: 'error' }); },
    topNotice: <AdminTopNoticeHost scaffold={scaffold} inlineInsets={inlineInsets} dismissLabel={localizedGetter('closeAction', locale)} />,
  };
}
