import type { ReactNode } from 'react';
import { RoleProfileButton } from '../shared/navigation/RoleHeaderButton';
import { useAccountSwitcherLauncher } from './useAccountSwitcherLauncher';

/** One responder owns tap and hold, so the hold fires while the finger is down. */
export function ProfilePressTarget({ onPress, children }: { onPress?: () => void; children: ReactNode }) {
  const switcher = useAccountSwitcherLauncher(onPress);
  return <RoleProfileButton label="Profil" hint={switcher.hint} onPress={switcher.onPress} onLongPress={switcher.open}>
    {children}
  </RoleProfileButton>;
}
