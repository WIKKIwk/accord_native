import type { RoleDrawerItem, RoleDrawerProps } from '../shared/navigation/roleDrawerModel';

export type WorkerDrawerProps = Pick<RoleDrawerProps, 'visible' | 'onOpen' | 'onClose' | 'onSelect' | 'children'> & {
  displayName: string;
  canTransfer?: boolean;
  active: string;
};

export function workerDrawerItems(displayName: string, canTransfer = false, paddons: RoleDrawerItem[] = []): RoleDrawerItem[] {
  return [
    { id: 'queue', label: 'Kuzatish', symbol: { ios: 'list.bullet.rectangle', android: 'view_list' } },
    { id: 'daily', label: 'Kunlik ish', symbol: { ios: 'calendar', android: 'today' } },
    ...paddons,
    { id: 'instructions', label: 'App yo‘riqnomasi', symbol: { ios: 'book', android: 'menu_book' } },
    ...(canTransfer ? [{ id: 'transfer', label: 'Joylashtirish va transfer', symbol: { ios: 'arrow.left.arrow.right' as const, android: 'swap_horiz' as const } }] : []),
    { id: 'profile', label: 'Profil', symbol: { ios: 'person.crop.circle', android: 'person' }, supportingText: displayName || undefined },
  ];
}
