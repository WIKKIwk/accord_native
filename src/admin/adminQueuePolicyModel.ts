import type { AdminApparatus } from '../apparatusApi';
import { dartTrim } from './dartJsonString';

export type ApparatusQueuePolicy = 'strict_sequence' | 'free_pick';
export type AdminApparatusQueuePolicy = {
  apparatus_id: string; apparatus: string; source_revision: number; source_aasx_sha256: string;
  policy: ApparatusQueuePolicy; locked: boolean; reason: string;
};
export type AdminQueuePolicyData = { apparatus: readonly AdminApparatus[]; policies: Readonly<Record<string, AdminApparatusQueuePolicy>> };

/** @v2 _AdminQueuePolicyPanelState._effectivePolicy */
export function adminQueuePolicyEffective(apparatus: AdminApparatus, policies: AdminQueuePolicyData['policies']): AdminApparatusQueuePolicy {
  const apparatus_id = dartTrim(apparatus.id);
  return Object.hasOwn(policies, apparatus_id) ? policies[apparatus_id] : {
    apparatus_id, apparatus: apparatus.name, source_revision: apparatus.source_revision, source_aasx_sha256: apparatus.source_aasx_sha256,
    policy: 'strict_sequence', locked: false, reason: '',
  };
}
export function adminQueuePolicyVisible(data: AdminQueuePolicyData, apparatusId?: string): readonly AdminApparatus[] {
  const filter = dartTrim(apparatusId ?? '');
  return filter ? data.apparatus.filter(item => item.id === filter) : data.apparatus;
}

/** @v2 _AdminQueuePolicyPanelState._cache
 * Source keeps one unscoped warm value, including across account/server changes.
 */
export class AdminQueuePolicyCache {
  private value: AdminQueuePolicyData | null = null;
  get(): AdminQueuePolicyData | null { return this.value; }
  set(data: AdminQueuePolicyData): void { this.value = data; }
}
