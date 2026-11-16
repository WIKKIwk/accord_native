import type { AdminRoleAssignment } from './adminUsersModel';
import { dartPartialLower, dartTrim } from './dartJsonString';

/** @v2 adminAssignmentForCustomerRef / adminAssignmentForPrincipalRole: trimmed case-sensitive identity. */
export function adminCustomerApparatusAssignment(rows: readonly AdminRoleAssignment[], ref: string, material: boolean): AdminRoleAssignment | null {
  return rows.find(row => dartTrim(row.principal_ref) === dartTrim(ref) && (material ? row.principal_role === 'material_taminotchi' : row.principal_role === 'customer' || row.principal_role === 'aparatchi')) ?? null;
}
export function adminCustomerApparatusVisible(assignment: AdminRoleAssignment | null, material: boolean): boolean {
  return material ? assignment?.principal_role === 'material_taminotchi' : !!assignment && dartPartialLower(dartTrim(assignment.role_id)) === 'aparatchi';
}
/** @v2 adminAparatchiAssignmentUpsert / adminMaterialTaminotchiAssignmentUpsert. */
export function adminCustomerApparatusUpsert(ref: string, material: boolean, assignment: AdminRoleAssignment | null, selected: readonly string[]): AdminRoleAssignment {
  if (material && !assignment) throw new Error('Material supplier assignment missing');
  return Object.freeze({ principal_role: material ? 'material_taminotchi' : 'aparatchi', principal_ref: dartTrim(material ? assignment!.principal_ref : ref),
    role_id: material ? dartTrim(assignment!.role_id) || 'material_taminotchi' : 'aparatchi', assigned_apparatus: Object.freeze([...selected].sort()),
    assigned_item_groups: material ? assignment!.assigned_item_groups : Object.freeze([]) });
}
