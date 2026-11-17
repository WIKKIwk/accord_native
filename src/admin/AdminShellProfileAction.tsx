import { router, useIsFocused, type Href } from 'expo-router';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { appRoutes } from '../shared/appRoutes';
import { AdminProfileAction } from './AdminProfileAction';
import { useAdminShell } from './AdminShellContext';

/** Bind the existing profile/account control to the original shell and real route. */
export function AdminShellProfileAction() {
  const shell = useAdminShell(), focused = useIsFocused(), focus = useRef(focused);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  const canInteract = useCallback(() => focus.current && shell.isCurrent(), [shell]);
  const onProfile = useCallback(() => {
    if (!canInteract()) return;
    const path = shell.destination(appRoutes.profile, Platform.OS);
    if (path && canInteract()) router.push(path as Href);
  }, [shell, canInteract]);
  return <AdminProfileAction session={shell.session} witness={shell.witness} isCurrent={shell.isCurrent}
    canInteract={canInteract} onProfile={onProfile} />;
}
