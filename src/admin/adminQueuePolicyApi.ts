import { nativeEpochMicroseconds } from '../../modules/accord-native-clock/src/AccordNativeClockModule';
import type { Session } from '../auth';
import { isCanonicalApparatusId, WorkerControlException } from '../workerControlsApi';
import { parseApparatusQueuePolicyMap } from '../workerQueueModels';
import { MobileApiException } from '../shared/mobileApiException';
import { adminProductionRequest, checkedAdminGuard, type AdminRequestGuard } from './adminProductionRequest';
import { dartJsonString, dartTrim } from './dartJsonString';
import type { AdminApparatusQueuePolicy, ApparatusQueuePolicy } from './adminQueuePolicyModel';

const path = '/v1/mobile/admin/production-maps/queue-policies';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Adapt Dart's JSON string conversion/edge trim before reusing the shared policy decoder. */
function queuePoliciesFromJson(raw: unknown): Record<string, AdminApparatusQueuePolicy> {
  const items = Array.isArray(raw) ? raw : object(raw) ? Object.values(raw) : [];
  const values = items.map(value => {
    if (!object(value)) return value;
    const text = (field: unknown) => field == null ? '' : dartJsonString(field);
    return { ...value, apparatus_id: dartTrim(text(value.apparatus_id)), apparatus: text(value.apparatus),
      source_aasx_sha256: dartTrim(text(value.source_aasx_sha256)), discipline: dartTrim(text(value.discipline ?? value.policy)), reason: text(value.reason) };
  });
  return parseApparatusQueuePolicyMap(values) as Record<string, AdminApparatusQueuePolicy>;
}
let mutationCounter = 0n;
/** @v2 MobileApi._nextCanonicalMutationIdempotencyKey */
export function nextAdminQueuePolicyIdempotencyKey(microseconds: () => string = nativeEpochMicroseconds): string {
  mutationCounter++;
  return `mobile:canonical-apparatus:queue-policy:${BigInt(microseconds()).toString(36)}-${mutationCounter.toString(36)}`;
}

/** @v2 adminApparatusQueuePolicies */
export async function adminApparatusQueuePolicies(session: Session, guard?: AdminRequestGuard, readWitness?: () => boolean): Promise<Record<string, AdminApparatusQueuePolicy>> {
  const check = checkedAdminGuard(guard); check?.();
  const value = await adminProductionRequest(session, path, undefined, 'queue_policies', check, readWitness);
  if (!object(value)) throw new TypeError('Invalid queue policy response');
  const policies = queuePoliciesFromJson(value.policies);
  check?.(); return policies;
}

/** @v2 adminUpdateApparatusQueuePolicy */
export async function adminUpdateApparatusQueuePolicy(session: Session,
  input: { apparatusId: string; expectedRevision: number; policy: ApparatusQueuePolicy }, guard?: AdminRequestGuard,
  nextKey: () => string = nextAdminQueuePolicyIdempotencyKey): Promise<AdminApparatusQueuePolicy> {
  const check = checkedAdminGuard(guard); check?.();
  const normalized = dartTrim(input.apparatusId);
  if (!isCanonicalApparatusId(normalized)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  if (!Number.isInteger(input.expectedRevision) || !['strict_sequence', 'free_pick'].includes(input.policy)) throw new TypeError('Invalid queue policy command');
  const key = nextKey();
  if (typeof key !== 'string' || !/^mobile:canonical-apparatus:queue-policy:-?[0-9a-z]+-[0-9a-z]+$/.test(key)) throw new TypeError('Invalid queue policy idempotency key');
  const value = await adminProductionRequest(session, path, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({ apparatus_id: normalized, expected_revision: input.expectedRevision, discipline: input.policy }) }, 'queue_policies', check);
  if (!object(value)) throw new TypeError('Invalid queue policy response');
  if (!object(value.revision) || !object(value.revision.revision)) throw new MobileApiException({
    code: 'queue_policies_invalid_response', message: 'Aparat navbat qoidasi javobi noto‘g‘ri' });
  const committed = value.revision, revision = committed.revision as Record<string, unknown>, metadata = object(revision.revision_metadata) ? revision.revision_metadata : null;
  const rawRevision = metadata?.revision;
  if (rawRevision != null && (typeof rawRevision !== 'number' || !Number.isFinite(rawRevision))) throw new TypeError('Invalid queue policy revision');
  const policy = object(revision.policies) ? revision.policies.queue : null;
  const result: AdminApparatusQueuePolicy = {
    apparatus_id: revision.apparatus_id == null ? normalized : dartTrim(dartJsonString(revision.apparatus_id)), apparatus: '',
    source_revision: rawRevision == null ? input.expectedRevision + 1 : Math.trunc(rawRevision as number),
    source_aasx_sha256: committed.aasx_sha256 == null ? '' : dartTrim(dartJsonString(committed.aasx_sha256)),
    policy: policy != null && dartTrim(dartJsonString(policy)) === 'free_pick' ? 'free_pick' : 'strict_sequence', locked: false, reason: '',
  };
  check?.(); return result;
}
