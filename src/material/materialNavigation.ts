import type { Session } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import type { RoleDrawerItem } from '../shared/navigation/roleDrawerModel';

/** @v2 MaterialTaminotchiNavigationDrawer */
export function materialDrawerItems(session: Session, labels: { home: string; profile: string }): RoleDrawerItem[] {
  if (session.profile.role !== 'material_taminotchi' || !canOpenRoute(session, appRoutes.materialHome)) return [];
  return [
    { id: 'home', label: labels.home, symbol: { ios: 'house', android: 'home' } },
    ...(canOpenRoute(session, appRoutes.materialTasks) ? [{ id: 'tasks', label: 'Vazifalar', symbol: { ios: 'checklist' as const, android: 'assignment' as const } }] : []),
    ...(canOpenRoute(session, appRoutes.supplySequence) ? [{ id: 'sequence', label: 'Ketma-ketlik', symbol: { ios: 'list.number' as const, android: 'format_list_numbered' as const } }] : []),
    ...(canOpenRoute(session, appRoutes.gscaleMode) ? [{ id: 'receipt', label: 'Kirim', symbol: { ios: 'scalemass' as const, android: 'scale' as const } }] : []),
    ...(canOpenRoute(session, appRoutes.materialHistory) ? [{ id: 'history', label: 'Harakatlar tarixi', symbol: { ios: 'clock.arrow.circlepath' as const, android: 'history' as const } }] : []),
    ...(canOpenRoute(session, appRoutes.adminRawMaterialAssignments) ? [{ id: 'assignments', label: 'Homashyo biriktirish', symbol: { ios: 'shippingbox' as const, android: 'inventory_2' as const } }] : []),
    ...(canOpenRoute(session, appRoutes.inventoryMovements) ? [{ id: 'movements', label: 'Joylashtirish va transfer', symbol: { ios: 'arrow.left.arrow.right' as const, android: 'swap_horiz' as const } }] : []),
    { id: 'profile', label: labels.profile, symbol: { ios: 'person', android: 'person' } },
  ];
}
export function materialDrawerActive(path: string): string {
  const route = path.replace(/^\/(ios|android)-material\/?/, '');
  return ['tasks', 'history', 'profile', 'sequence', 'receipt', 'assignments', 'movements', 'chat'].includes(route.split('/')[0]) ? route.split('/')[0] : route ? '' : 'home';
}
export function materialRoute(id: string, platform: 'ios' | 'android'): string | null {
  const base = `/${platform}-material`;
  return id === 'home' ? base : ['profile', 'tasks', 'history', 'sequence', 'receipt', 'assignments', 'movements', 'chat'].includes(id) ? `${base}/${id}` : null;
}
