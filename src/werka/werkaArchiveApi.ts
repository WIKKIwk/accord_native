import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { parseCreatedLabelTimestamp } from '../shared/dispatchRuntimeStores';
import { dispatchRecordFromJson } from '../shared/notificationApi';
import { werkaDartTrim } from './werkaBatchTrim';
import { werkaReadScope } from './werkaReadScope';

type Obj = Record<string, unknown>;
export type WerkaArchiveKind = 'received' | 'sent' | 'returned';
export type WerkaArchivePeriod = 'daily' | 'monthly' | 'yearly' | 'custom';
export type WerkaArchiveQuery = { kind: WerkaArchiveKind; period: WerkaArchivePeriod; from?: Date | null; to?: Date | null };
const object = (value: unknown): Obj => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid archive object');
  return value as Obj;
};
const string = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid archive string');
  return value;
};
const number = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value !== 'number') throw new TypeError('Invalid archive number');
  return value;
};
const list = (value: unknown): unknown[] => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Invalid archive list');
  return value;
};

/** @v2 parseWerkaArchiveKind */
export function parseWerkaArchiveKind(value: string): WerkaArchiveKind {
  const normalized = werkaDartTrim(value).toLowerCase();
  return normalized === 'received' || normalized === 'returned' ? normalized : 'sent';
}
/** @v2 parseWerkaArchivePeriod */
export function parseWerkaArchivePeriod(value: string): WerkaArchivePeriod {
  const normalized = werkaDartTrim(value).toLowerCase();
  return normalized === 'daily' || normalized === 'monthly' || normalized === 'custom' ? normalized : 'yearly';
}

/** @v2 ArchiveTotalByUOM */
export function archiveTotalByUOMFromJson(value: unknown) {
  const row = object(value);
  return { uom: string(row.uom), qty: number(row.qty) };
}
/** @v2 WerkaArchiveSummary */
export function werkaArchiveSummaryFromJson(value: unknown) {
  const row = object(value);
  return { recordCount: Math.trunc(number(row.record_count)), totalsByUOM: list(row.totals_by_uom).map(archiveTotalByUOMFromJson) };
}
/** @v2 WerkaArchiveResponse */
export function werkaArchiveResponseFromJson(value: unknown) {
  const row = object(value), from = string(row.from), to = string(row.to);
  const parseDate = (date: string): Date | null => {
    // Unlike created-label parsing, DateTime.tryParse receives this raw value.
    if (date !== werkaDartTrim(date)) return null;
    const time = parseCreatedLabelTimestamp(date);
    return time == null ? null : new Date(time);
  };
  return { kind: parseWerkaArchiveKind(string(row.kind)), period: parseWerkaArchivePeriod(string(row.period)),
    from: parseDate(from), to: parseDate(to), summary: werkaArchiveSummaryFromJson(row.summary ?? {}),
    items: list(row.items).map(dispatchRecordFromJson) };
}

function archivePath(path: string, input: WerkaArchiveQuery): string {
  const query = new URLSearchParams({ kind: input.kind, period: input.period });
  if (input.from && input.to) {
    const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    query.set('from', format(input.from)); query.set('to', format(input.to));
  }
  return `${path}?${query}`;
}

/** @v2 werkaArchive */
export async function werkaArchive(session: Session, input: WerkaArchiveQuery) {
  const check = werkaReadScope(session);
  let response: Response;
  try { response = await authorizedFetch(session, archivePath('/v1/mobile/werka/archive', input), undefined, check); }
  finally { check(); }
  let status: number;
  try { status = response.status; } finally { check(); }
  if (status !== 200) throw new Error('Werka archive failed');
  let raw: unknown;
  try { raw = await response.json(); } finally { check(); }
  try { return werkaArchiveResponseFromJson(raw); } finally { check(); }
}

/** @v2 downloadWerkaArchivePdf */
export async function downloadWerkaArchivePdf(session: Session, input: WerkaArchiveQuery) {
  const check = werkaReadScope(session);
  let response: Response;
  try { response = await authorizedFetch(session, archivePath('/v1/mobile/werka/archive/pdf', input), undefined, check); }
  finally { check(); }
  let status: number;
  try { status = response.status; } finally { check(); }
  if (status !== 200) throw new Error('Werka archive pdf failed');
  let filename: string, contentType: string;
  try {
    const disposition = response.headers.get('content-disposition') ?? '';
    filename = (disposition.match(/filename="?([^";]+)"?/)?.[1] ?? 'werka-archive.pdf').trim();
    contentType = response.headers.get('content-type') ?? 'application/pdf';
  } finally { check(); }
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(await response.arrayBuffer()); } finally { check(); }
  return { filename, contentType, bytes };
}
