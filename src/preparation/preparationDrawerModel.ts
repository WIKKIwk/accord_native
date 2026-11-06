import type { RoleDrawerItem } from '../shared/navigation/roleDrawerModel';

/** @v2 PreparationDrawer */
export function preparationDrawerItems(access: { scale: boolean; inventory: boolean }, t: (text: string) => string): RoleDrawerItem[] {
  return [
    { id: 'home', label: t('Tayyorlov'), symbol: { ios: 'flask', android: 'science' } },
    { id: 'formulas', label: t('Formulalar'), symbol: { ios: 'function', android: 'functions' } },
    { id: 'production', label: t('Ishlab chiqarish'), symbol: { ios: 'gearshape.2', android: 'precision_manufacturing' } },
    { id: 'sequence', label: t('Ketma-ketlik'), symbol: { ios: 'list.number', android: 'format_list_numbered' } },
    ...(access.scale ? [{ id: 'scale', label: t('Kirim'), symbol: { ios: 'scalemass' as const, android: 'scale' as const } }] : []),
    { id: 'chat', label: t('Chat'), symbol: { ios: 'bubble.left', android: 'chat_bubble_outline' }, disabled: true },
    ...(access.inventory ? [{ id: 'inventory', label: t('Ishlab chiqarilgan homashyolar'), symbol: { ios: 'arrow.left.arrow.right' as const, android: 'swap_horiz' as const } }] : []),
    { id: 'profile', label: t('Profil'), symbol: { ios: 'person', android: 'person' } },
  ];
}

export function preparationDrawerActive(pathname: string) {
  const page = pathname.replace(/^\/(ios|android)-preparation\/?/, '');
  if (!page) return 'home';
  if (page === 'catalog' || page === 'formulas') return 'formulas';
  if (page.startsWith('production')) return 'production';
  return ['sequence', 'inventory', 'profile'].includes(page) ? page : '';
}

export function preparationDrawerRoute(id: string, platform: 'ios' | 'android'): { path: string; kind: 'root' | 'push' | 'tab' } | null {
  const base = `/${platform}-preparation`;
  switch (id) {
    case 'home': return { path: base, kind: 'root' };
    case 'formulas': return { path: `${base}/${platform === 'ios' ? 'catalog' : 'formulas'}`, kind: 'root' };
    case 'production': return { path: `${base}/production`, kind: 'root' };
    case 'sequence': return { path: `${base}/sequence`, kind: 'push' };
    case 'inventory': return { path: `${base}/inventory`, kind: 'push' };
    case 'profile': return { path: `${base}/profile`, kind: 'tab' };
    default: return null;
  }
}
