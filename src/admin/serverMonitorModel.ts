import { dartJsonString } from './dartJsonString';

type Obj = Record<string, unknown>;
function map(value: unknown): Obj {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid monitor map');
  return value as Obj;
}
function array(value: unknown): unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Invalid monitor list');
  return value;
}
const text = (value: unknown) => value == null ? '' : dartJsonString(value);
function number(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid monitor number');
  return value;
}
const integer = (value: unknown) => Math.trunc(number(value));
function round(value: unknown): number {
  const n = number(value), result = Math.sign(n) * Math.round(Math.abs(n));
  return result === 0 ? 0 : result;
}
const isMap = (value: unknown): value is Obj => value !== null && typeof value === 'object' && !Array.isArray(value);

/** @v2 AdminServerMonitorBackupFile */
export type AdminServerMonitorBackupFile = { name: string; path: string; size_bytes: number; modified_at_unix: number; age_seconds: number };
export function monitorBackupFileFromJson(value: unknown): AdminServerMonitorBackupFile {
  const row = map(value);
  return { name: text(row.name), path: text(row.path), size_bytes: integer(row.size_bytes),
    modified_at_unix: integer(row.modified_at_unix), age_seconds: integer(row.age_seconds) };
}
/** @v2 AdminServerMonitorBackupSnapshot */
export type AdminServerMonitorBackupSnapshot = { id: string; status: string; source: string; requested_by: string; created_at_unix: number;
  started_at_unix: number; completed_at_unix: number; size_bytes: number; artifact_name: string; checksum_sha256: string;
  verified: boolean; error: string };
export function monitorBackupSnapshotFromJson(value: unknown): AdminServerMonitorBackupSnapshot {
  const row = map(value);
  return { id: text(row.id), status: text(row.status), source: text(row.source), requested_by: text(row.requested_by),
    created_at_unix: integer(row.created_at_unix), started_at_unix: integer(row.started_at_unix),
    completed_at_unix: integer(row.completed_at_unix), size_bytes: integer(row.size_bytes), artifact_name: text(row.artifact_name),
    checksum_sha256: text(row.checksum_sha256), verified: row.verified === true, error: text(row.error) };
}
export const monitorBackupReady = (item: AdminServerMonitorBackupSnapshot) => item.status === 'ready' && item.verified;
export const monitorBackupRunning = (item: AdminServerMonitorBackupSnapshot) => ['queued', 'running', 'verifying'].includes(item.status);
/** @v2 AdminServerMonitorBackups */
export type AdminServerMonitorBackups = { directory: string; exists: boolean; file_count: number; latest: AdminServerMonitorBackupFile | null;
  files: AdminServerMonitorBackupFile[]; error: string; snapshot_count: number; latest_snapshot: AdminServerMonitorBackupSnapshot | null;
  snapshots: AdminServerMonitorBackupSnapshot[]; active_job: AdminServerMonitorBackupSnapshot | null; healthy: boolean };
export function monitorBackupsFromJson(value: unknown): AdminServerMonitorBackups {
  const row = map(value), snapshots = array(row.snapshots).map(monitorBackupSnapshotFromJson);
  return { directory: text(row.directory), exists: row.exists === true, file_count: integer(row.file_count),
    latest: isMap(row.latest) ? monitorBackupFileFromJson(row.latest) : null, files: array(row.files).map(monitorBackupFileFromJson),
    error: text(row.error), snapshot_count: row.snapshot_count == null ? snapshots.length : integer(row.snapshot_count),
    latest_snapshot: isMap(row.latest_snapshot) ? monitorBackupSnapshotFromJson(row.latest_snapshot) : null, snapshots,
    active_job: isMap(row.active_job) ? monitorBackupSnapshotFromJson(row.active_job) : null,
    healthy: Object.hasOwn(row, 'healthy') ? row.healthy === true : integer(row.file_count) > 0 };
}
/** @v2 AdminServerMonitorDatabase */
export type AdminServerMonitorDatabase = { configured: boolean; reachable: boolean; status: string; ping_ms: number; error: string };
export function monitorDatabaseFromJson(value: unknown): AdminServerMonitorDatabase {
  const row = map(value);
  return { configured: row.configured === true, reachable: row.reachable === true, status: text(row.status), ping_ms: integer(row.ping_ms), error: text(row.error) };
}
/** @v2 AdminServerMonitorServer */
export type AdminServerMonitorServer = { bind_addr: string; started_at_unix: number; uptime_seconds: number; status: string };
export function monitorServerFromJson(value: unknown): AdminServerMonitorServer {
  const row = map(value);
  return { bind_addr: text(row.bind_addr), started_at_unix: integer(row.started_at_unix), uptime_seconds: integer(row.uptime_seconds), status: text(row.status) };
}
/** @v2 AdminServerMonitorRuntime */
export type AdminServerMonitorRuntime = { cpu_percent: number; memory_percent: number; memory_used_mb: number; memory_total_mb: number;
  disk_path: string; disk_percent: number; disk_used_mb: number; disk_total_mb: number; disk_available_mb: number;
  load_average: number; sample_seconds: number };
export function monitorRuntimeFromJson(value: unknown): AdminServerMonitorRuntime {
  const row = map(value);
  return { cpu_percent: round(row.cpu_percent), memory_percent: round(row.memory_percent), memory_used_mb: round(row.memory_used_mb),
    memory_total_mb: round(row.memory_total_mb), disk_path: text(row.disk_path), disk_percent: round(row.disk_percent),
    disk_used_mb: round(row.disk_used_mb), disk_total_mb: round(row.disk_total_mb), disk_available_mb: round(row.disk_available_mb),
    load_average: number(row.load_average), sample_seconds: round(row.sample_seconds) };
}
/** @v2 AdminServerMonitorReport */
export type AdminServerMonitorReport = { server: AdminServerMonitorServer; database: AdminServerMonitorDatabase;
  backups: AdminServerMonitorBackups; runtime: AdminServerMonitorRuntime };
export function monitorReportFromJson(value: unknown): AdminServerMonitorReport {
  const row = map(value);
  return { server: monitorServerFromJson(row.server ?? {}), database: monitorDatabaseFromJson(row.database ?? {}),
    backups: monitorBackupsFromJson(row.backups ?? {}), runtime: monitorRuntimeFromJson(row.runtime ?? {}) };
}
/** @v2 AdminServerMonitorLiveEvent */
export type AdminServerMonitorLiveEvent = { report: AdminServerMonitorReport | null; latency_ms: number | null };
export function monitorLiveEventFromJson(value: unknown, nowMs: () => number = Date.now): AdminServerMonitorLiveEvent {
  const row = map(value);
  if (row.ok === true) return { report: monitorReportFromJson(row), latency_ms: null };
  if (row.type === 'pong' && row.sent_at_ms != null) {
    const sentAt = integer(row.sent_at_ms);
    if (sentAt > 0) return { report: null, latency_ms: Math.max(1, nowMs() - sentAt) };
  }
  return { report: null, latency_ms: null };
}
