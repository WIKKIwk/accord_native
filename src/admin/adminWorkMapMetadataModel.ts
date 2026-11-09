import { adminWorkMapClosedTime } from './adminWorkMapClosedModel';
import { dartTrim } from './dartJsonString';

export type AdminWorkMapMetadata = { createdAtUnix: number | null; creator: { role: string; displayName: string } | null };
export type AdminWorkMapMetadataRow = { id: 'created-at' | 'created-by'; label: string; value: string };
type SavedMetadata = { created_at_unix?: number | null; created_by?: { role: string; display_name: string } | null };

/** Retain already-hydrated fields only; fail malformed dates before a result reaches the native renderer. */
export function adminWorkMapMetadataFromSaved(saved: SavedMetadata): AdminWorkMapMetadata {
  const createdAtUnix = saved.created_at_unix ?? null;
  adminWorkMapClosedTime(createdAtUnix ?? 0);
  return { createdAtUnix, creator: saved.created_by == null ? null : {
    role: dartTrim(saved.created_by.role), displayName: dartTrim(saved.created_by.display_name) } };
}
export function adminWorkMapMetadataRows(metadata: AdminWorkMapMetadata | null, role: unknown, kind: string,
  text: { admin: (key: string) => string; loading: string }): AdminWorkMapMetadataRow[] {
  if (kind !== 'order' || (role !== 'admin' && role !== 'brigader')) return [];
  const date = metadata == null ? '' : adminWorkMapClosedTime(metadata.createdAtUnix ?? 0), creator = metadata?.creator;
  const creatorRole = creator == null ? '' : ['admin', 'brigader', 'sales_manager', 'telegram'].includes(creator.role)
    ? text.admin(`detail.creator_role.${creator.role}`) : creator.role;
  return [
    { id: 'created-at', label: text.admin('detail.created_at'), value: metadata == null ? text.loading : date || text.admin('detail.date_missing') },
    { id: 'created-by', label: text.admin('detail.created_by'), value: metadata == null ? text.loading
      : !creator || !creatorRole || !creator.displayName ? text.admin('detail.creator_missing') : `${creatorRole} · ${creator.displayName}` },
  ];
}
