import type { Session } from './auth';

const values = (input: unknown): string[] => Array.isArray(input)
  ? [...new Set(input.filter((value): value is string => typeof value === 'string'))].sort()
  : [];

/** @v2 currentSessionReadScope */
export function sessionReadScope(session: Session): string {
  return JSON.stringify([
    session.baseUrl,
    session.profile?.role ?? null,
    session.profile?.ref ?? null,
    values(session.capabilities),
    values(session.assigned_apparatus),
    values(session.assigned_item_groups ?? session.profile?.assigned_item_groups),
    values(session.assigned_warehouses ?? session.profile?.assigned_warehouses),
  ]);
}
