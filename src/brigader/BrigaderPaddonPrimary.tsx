import type { AdminMenuAction } from '../admin/adminCreateMenuController';
import { appRoutes } from '../shared/appRoutes';
import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import { useBrigaderFeature } from './BrigaderFeatureContext';

const icons: Record<string, AdminMenuAction['icon']> = {
  scan: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' },
  add: { ios: 'text.badge.plus', android: 'playlist_add' },
  remove: { ios: 'text.badge.minus', android: 'playlist_remove' },
  confirm: { ios: 'checkmark', android: 'check' },
  cancel: { ios: 'xmark', android: 'close' },
  close: { ios: 'xmark', android: 'close' },
};
/** The existing paddon controller supplies the actual actions and their enable rules. */
export function BrigaderPaddonPrimary({ actions, select }: {
  actions: readonly { id: string; label: string; enabled: boolean }[];
  select: (id: string) => void;
}) {
  const page = useBrigaderFeature(appRoutes.apparatusPaddonDetail);
  return <BrigaderPrimaryAction isCurrent={page.current} canInteract={page.interactive}
    actions={actions.map(action => ({ ...action, icon: icons[action.id], onPress: () => select(action.id) }))} />;
}
