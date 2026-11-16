import { searchMatches } from '../shared/searchNormalizer';
import { searchRelevanceScore } from '../qolip/qolipSearchRelevance';
import { adminUserRoleLabel, type AdminRoleAssignment, type AdminUserListEntry, type AdminUserListPage, type AdminUserPrincipalRole } from './adminUsersModel';
import { dartPartialLower, dartTrim } from './dartJsonString';

export type AdminWarehouseAssigneeReads = {
  users: (role: string, offset: number, guard: () => void, witness: () => boolean) => Promise<AdminUserListPage>;
  assignments: (guard: () => void, witness: () => boolean) => Promise<readonly AdminRoleAssignment[]>;
};
/** @v2 _loadWarehouseUserPages
 * Offset advances by the actual returned page length. */
async function userPages(reads: AdminWarehouseAssigneeReads, role: string, guard: () => void, witness: () => boolean) {
  const users: AdminUserListEntry[] = []; let offset = 0;
  while (true) {
    guard(); const page = await reads.users(role, offset, guard, witness); guard(); users.push(...page.items);
    if (!page.has_more) return users;
    if (!page.items.length) throw new Error('Warehouse assignee pagination did not advance');
    offset += page.items.length;
  }
}
/** @v2 _isWarehouseAssigneeCandidate */
export function isAdminWarehouseAssignee(user: AdminUserListEntry): boolean {
  return ['werka', 'materialTaminotchi', 'qolipchi'].includes(user.kind) ||
    ['werka', 'material_taminotchi', 'qolipchi'].includes(user.principal_role) ||
    (user.kind === 'worker' && dartPartialLower(dartTrim(adminUserRoleLabel(user))) === 'brigader');
}
/** @v2 _loadWarehouseAssigneeUsers */
export async function loadAdminWarehouseAssignees(reads: AdminWarehouseAssigneeReads, guard: () => void, witness: () => boolean): Promise<readonly AdminUserListEntry[]> {
  guard();
  const [general, qolipchi, material, workers, assignments] = await Promise.all([
    userPages(reads, 'werka', guard, witness), userPages(reads, 'qolipchi', guard, witness),
    userPages(reads, 'material_taminotchi', guard, witness), userPages(reads, 'worker', guard, witness), reads.assignments(guard, witness),
  ]); guard();
  const promoted = workers.flatMap(worker => {
    const assignment = assignments.find(item => dartTrim(item.principal_ref) === dartTrim(worker.id) &&
      (item.principal_role === 'qolipchi' || dartTrim(item.role_id) === 'qolipchi'));
    if (!assignment && dartPartialLower(dartTrim(adminUserRoleLabel(worker))) !== 'brigader') return [];
    return [Object.freeze({ ...worker, kind: assignment ? 'qolipchi' as const : 'worker' as const,
      principal_role: assignment ? 'qolipchi' as const : 'aparatchi' as const, role_label: assignment ? 'Qolipchi' : 'Brigader',
      apparatus_display: '', apparatus_id: '' })];
  });
  const byKey = new Map<string, AdminUserListEntry>();
  for (const user of [...general, ...qolipchi, ...material, ...promoted]) {
    if (!user.blocked && isAdminWarehouseAssignee(user)) byKey.set(`${user.kind}:${dartPartialLower(dartTrim(user.id))}`, user);
  }
  const result = [...byKey.values()].sort((a, b) => {
    const left = dartPartialLower(a.name), right = dartPartialLower(b.name); return left < right ? -1 : left > right ? 1 : 0;
  }); guard(); return Object.freeze(result);
}
/** @v2 _roleForUser
 * Role overrides precede kind, including a promoted Brigader remaining aparatchi. */
export function adminWarehouseRoleForUser(user: AdminUserListEntry): AdminUserPrincipalRole {
  if (user.principal_role === 'qolipchi' || user.principal_role === 'boyoqchi') return user.principal_role;
  const roles: Record<AdminUserListEntry['kind'], AdminUserPrincipalRole> = { rezkaMaster: 'rezka_master', brigader: 'brigader',
    salesManager: 'sales_manager', tayyorlovMasteri: 'tayyorlov_masteri', homashyoRezkachi: 'homashyo_rezkachi', supplier: 'supplier',
    werka: 'werka', customer: 'customer', materialTaminotchi: 'material_taminotchi', qolipchi: 'qolipchi', boyoqchi: 'boyoqchi', worker: 'aparatchi', metalayzer: 'metalayzer' };
  return roles[user.kind];
}
/** @v2 M3PickerSheet
 * Search all four fields; relevance ranks only name and the visible subtitle. */
export function adminWarehouseAssigneeSearch(users: readonly AdminUserListEntry[], query: string): readonly AdminUserListEntry[] {
  const visible = users.filter(user => searchMatches(query, [user.name, user.phone, user.id, adminUserRoleLabel(user)]));
  if (!dartTrim(query) || visible.length < 2) return visible;
  return visible.map((user, index) => ({ user, index, score: searchRelevanceScore(query, user.name, [adminUserRoleLabel(user)]) }))
    .sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.user);
}
