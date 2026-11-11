import type { RoleDrawerItem, RoleDrawerProps } from '../shared/navigation/roleDrawerModel';

export type WorkerDrawerProps = Pick<RoleDrawerProps, 'visible' | 'onOpen' | 'onClose' | 'onSelect' | 'children'> & {
  displayName: string;
  canTransfer?: boolean;
  showDailyWork?: boolean;
  active: string;
};

export function workerDrawerItems(displayName: string, canTransfer = false, paddons: RoleDrawerItem[] = [], text = (source: string) => source, showDailyWork = true): RoleDrawerItem[] {
  return [
    { id: 'queue', label: text('Kuzatish'), symbol: { ios: 'list.bullet.rectangle', android: 'view_list' } },
    ...(showDailyWork ? [{ id: 'daily', label: text('Kunlik ish'), symbol: { ios: 'calendar' as const, android: 'today' as const } }] : []),
    ...paddons,
    { id: 'instructions', label: text('App yo‘riqnomasi'), symbol: { ios: 'book', android: 'menu_book' } },
    ...(canTransfer ? [{ id: 'transfer', label: text('Joylashtirish va transfer'), symbol: { ios: 'arrow.left.arrow.right' as const, android: 'swap_horiz' as const } }] : []),
    { id: 'profile', label: text('Profil'), symbol: { ios: 'person.crop.circle', android: 'person' }, supportingText: displayName || undefined },
  ];
}
