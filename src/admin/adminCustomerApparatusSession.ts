import { adminApparatus } from '../apparatusApi';
import type { AdminCustomerApparatusProps } from './AdminCustomerDetailScreenTypes';
import { AdminCustomerApparatusController } from './adminCustomerApparatusController';
import { adminCustomerChildScope } from './adminCustomerChildScope';
import { AdminCustomerDetailApiException, adminCustomerUpsertRoleAssignment } from './adminCustomerDetailApi';
import { adminRoleAssignments } from './adminUsersApi';

export function adminCustomerApparatusSession(props: Pick<AdminCustomerApparatusProps, 'session' | 'witness' | 'isCurrent' | 'customerRef' | 'materialTaminotchi' | 'onChanged'>) {
  const { session, witness, isCurrent, customerRef, materialTaminotchi } = props, current = adminCustomerChildScope(session, witness, isCurrent);
  const controller = new AdminCustomerApparatusController({ isCurrent: current, ref: customerRef, material: materialTaminotchi,
    assignments: async (guard, readWitness) => { try { return await adminRoleAssignments(session, guard, readWitness); }
      catch (error) { guard(); if (error instanceof Error && error.message === 'Admin role assignments failed') throw new AdminCustomerDetailApiException(error.message); throw error; } },
    apparatus: (guard, readWitness) => adminApparatus(session, { limit: 200, beforeSend: guard, readWitness }),
    save: (assignment, guard) => adminCustomerUpsertRoleAssignment(session, assignment, guard), changed: props.onChanged });
  return { current, controller };
}
