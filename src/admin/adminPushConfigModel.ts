import type { FirebaseClientConfig } from '../mobilePushConfigApi';
import { MobileApiException } from '../shared/mobileApiException';
import { dartJsonString, dartTrim } from './dartJsonString';

export type AdminPushConfig = { configured: boolean; project_id: string; client_email: string; source: string;
  last_verified_at: number | null; android: FirebaseClientConfig | null; ios: FirebaseClientConfig | null; error: string };
export type AdminPushConfigPlatform = 'android' | 'ios';
export type AdminPushConfigFile = { name: string; size: number; bytes: Uint8Array | null };
export const pushConfigObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid push configuration');
  return value as Record<string, unknown>;
};
const text = (value: unknown) => value == null ? '' : dartJsonString(value);

/** @v2 FirebaseClientConfig.fromJson */
export function adminPushConfigClientFromJson(value: unknown): FirebaseClientConfig {
  const row = pushConfigObject(value), keys = ['project_id', 'app_id', 'api_key', 'messaging_sender_id', 'application_id'] as const;
  if (keys.some(key => typeof row[key] !== 'string')) throw new TypeError('Invalid Firebase client configuration');
  return Object.fromEntries(keys.map(key => [key, row[key]])) as FirebaseClientConfig;
}

/** @v2 AdminPushConfig.fromJson */
export function adminPushConfigFromJson(value: unknown): AdminPushConfig {
  const row = pushConfigObject(value), mobile = row.mobile == null ? null : pushConfigObject(row.mobile), verified = row.last_verified_at;
  if (verified != null && (typeof verified !== 'number' || !Number.isFinite(verified))) throw new TypeError('Invalid verification time');
  return { configured: row.configured === true, project_id: text(row.project_id), client_email: text(row.client_email),
    source: text(row.source), last_verified_at: verified == null ? null : Math.trunc(verified as number), error: text(row.error),
    android: mobile?.android == null ? null : adminPushConfigClientFromJson(mobile.android),
    ios: mobile?.ios == null ? null : adminPushConfigClientFromJson(mobile.ios) };
}

const invalidAccount = (message: string) => new MobileApiException({ code: 'push_config_invalid_credentials', message });
/** Source AdminPushConfigScreen._parseAccount keeps the complete JSON object for the server. */
export function parseAdminPushConfigAccount(raw: string): Record<string, unknown> {
  try {
    if (new TextEncoder().encode(raw).length > 32768) throw new Error('File too large');
    const account = pushConfigObject(JSON.parse(raw));
    if (account.type !== 'service_account' || ['project_id', 'private_key', 'client_email'].some(key =>
      account[key] == null || !dartTrim(dartJsonString(account[key])))) throw new Error('Invalid service account');
    return account;
  } catch { throw invalidAccount('Invalid service account'); }
}

/** Source picker validation runs before parsing and never accepts a token or another file type. */
export function readAdminPushConfigAccountFile(file: AdminPushConfigFile): string {
  if (!file.name.toLowerCase().endsWith('.json') || file.size > 32768 || !file.bytes) throw invalidAccount('Invalid JSON file');
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(file.bytes);
  parseAdminPushConfigAccount(raw);
  return raw;
}

const errorKeys: Record<string, string> = {
  push_config_invalid_credentials: 'invalid', push_config_invalid_client_config: 'invalid_client', push_config_client_missing: 'client_missing',
  push_config_client_save_failed: 'client_save_failed', push_config_client_sync_failed: 'client_sync_failed', push_config_firebase_failed: 'firebase_failed',
  push_config_restart_required: 'restart_required', push_config_token_unavailable: 'token_unavailable', device_not_checked: 'device_not_checked',
  device_registered: 'device_registered', push_config_project_mismatch: 'project_mismatch', push_config_google_rejected: 'google_rejected',
  push_config_unreachable: 'unreachable', push_config_save_failed: 'save_failed', push_config_not_configured: 'not_configured',
  push_config_device_not_registered: 'device_missing', push_config_test_mode: 'test_mode', push_config_device_unavailable: 'device_unavailable',
  push_config_permission_denied: 'permission_denied', push_config_apns_unavailable: 'apns_unavailable', push_config_apns_registering: 'apns_registering',
  push_config_apns_entitlement_missing: 'apns_entitlement_missing', push_config_apns_registration_failed: 'apns_registration_failed',
  push_config_test_failed: 'test_failed', forbidden: 'admin_only',
};
export const adminPushConfigErrorKey = (code: string): string => Object.hasOwn(errorKeys, code) ? errorKeys[code] : 'failed';
