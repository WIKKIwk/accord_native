import { router, type Href } from 'expo-router';
import { useMemo, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { AdminPrimaryAction } from '../admin/AdminCreateHubProvider';
import type { AdminPrimaryActionProps } from '../admin/AdminCreateHubTypes';
import { useAdminShell } from '../admin/AdminShellContext';
import { adminDefaultCreateActions } from '../admin/adminDockModel';
import type { AdminMenuAction } from '../admin/adminCreateMenuController';
import { localeController } from '../shared/localization/runtime';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
const icons: Readonly<Record<string, AdminMenuAction['icon']>> = {
  group_add_outlined: { ios: 'person.badge.plus', android: 'group_add' },
  inventory_2_outlined: { ios: 'shippingbox', android: 'inventory_2' },
  qr_code_scanner_rounded: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' },
  list_alt_outlined: { ios: 'list.bullet.rectangle', android: 'list_alt' },
  add_task_outlined: { ios: 'checklist', android: 'add_task' },
};
/** Only real wired actions are exposed; unfinished shared Admin destinations never become dummy callbacks. */
export function BrigaderPrimaryAction(props: AdminPrimaryActionProps) {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const { isCurrent, canInteract } = props;
  const actions = useMemo(() => adminDefaultCreateActions(shell.session, locale).filter(action => !!shell.destination(action.routeName, Platform.OS)).map(action => ({
    id: action.id, label: action.label, icon: icons[action.materialIcon], onPress: () => {
      if (!isCurrent() || !canInteract() || !shell.isCurrent()) return;
      const path = shell.destination(action.routeName, Platform.OS); if (path) router.push(path as Href);
    },
  })), [shell, locale, isCurrent, canInteract]);
  return <AdminPrimaryAction {...props} actions={props.actions ?? actions} showPrimaryFab={props.showPrimaryFab !== false && actions.length > 0} />;
}
