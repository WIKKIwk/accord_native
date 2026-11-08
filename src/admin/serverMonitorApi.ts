import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { requireToken } from '../requireToken';
import { MobileApiException } from '../shared/mobileApiException';
import { dartJsonString } from './dartJsonString';
import { monitorBackupSnapshotFromJson, monitorReportFromJson,
  type AdminServerMonitorBackupSnapshot, type AdminServerMonitorReport } from './serverMonitorModel';

function backupErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    backup_already_running: 'Backup olish allaqachon boshlangan', backup_service_unavailable: 'Backup xizmati hozir mavjud emas',
    backup_not_ready: 'Backup hali yuklab olishga tayyor emas', backup_not_found: 'Backup topilmadi',
    backup_download_failed: 'Backup yuklab olinmadi', backup_import_invalid: 'Backup fayli noto‘g‘ri yoki qo‘llab-quvvatlanmaydi',
    backup_import_too_large: 'Backup fayli juda katta', backup_import_upload_failed: 'Backup serverga yuklanmadi',
    backup_import_upload_timeout: 'Backup yuklash uzoq vaqt javobsiz qoldi', backup_import_failed: 'Backup import qilinmadi',
    backup_service_failed: 'Backup xizmati xatolik berdi',
  };
  return messages[code] ?? 'Backup olish boshlanmadi';
}
/** @v2 adminServerMonitor */
export async function adminServerMonitor(session: Session): Promise<AdminServerMonitorReport> {
  const response = await authorizedFetch(session, '/v1/mobile/admin/system/monitor');
  if (response.status !== 200) throw new MobileApiException({ code: 'admin_server_monitor', message: 'Server monitor yuklanmadi' });
  return monitorReportFromJson(await response.json());
}
/** @v2 adminStartBackup */
export async function adminStartBackup(session: Session): Promise<AdminServerMonitorBackupSnapshot> {
  const response = await authorizedFetch(session, '/v1/mobile/admin/system/backups', { method: 'POST' });
  let payload: Record<string, unknown> = {};
  try {
    const value: unknown = await response.json();
    if (value && typeof value === 'object' && !Array.isArray(value)) payload = value as Record<string, unknown>;
  } catch { /* V2 treats an empty or malformed body as an empty map. */ }
  if (response.status !== 202) {
    const code = payload.error == null ? 'backup_start_failed' : dartJsonString(payload.error);
    throw new MobileApiException({ code, message: backupErrorMessage(payload.error == null ? '' : code), statusCode: response.status });
  }
  return monitorBackupSnapshotFromJson(payload);
}
/** @v2 adminServerMonitorLiveUri */
export function adminServerMonitorLiveUri(session: Session): URL {
  const uri = new URL(session.baseUrl);
  // Match authorizedFetch's authenticated-origin and HTTPS checks before putting a token in the URI.
  if (uri.protocol !== 'https:' || uri.origin !== session.baseUrl || uri.username || uri.password) {
    throw new Error('API manzili noto‘g‘ri.');
  }
  uri.protocol = 'wss:';
  uri.pathname = '/v1/mobile/admin/system/monitor/live';
  uri.search = '';
  uri.searchParams.set('token', requireToken(session));
  return uri;
}
