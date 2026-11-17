import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import type { FirebaseClientConfig } from '../mobilePushConfigApi';
import { MobileApiException } from '../shared/mobileApiException';
import { dartJsonString } from './dartJsonString';
import { adminPushConfigFromJson, pushConfigObject, type AdminPushConfig, type AdminPushConfigPlatform } from './adminPushConfigModel';

type Guard = () => void;
async function request(session: Session, method: 'GET' | 'PUT' | 'POST', suffix: '' | '/mobile' | '/check' | '/test',
  body: Record<string, unknown> | null, guard: Guard): Promise<Record<string, unknown>> {
  if (typeof guard !== 'function') throw new TypeError('Push configuration requires its original session guard');
  guard();
  if (session.token === 'test-mode-token') throw new MobileApiException({ code: 'push_config_test_mode', message: 'Unavailable in test mode' });
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) };
  guard();
  const response = await authorizedFetch(session, `/v1/mobile/admin/push-config${suffix}`, init, guard, method === 'GET' ? 10_000 : 40_000,
    method === 'GET' ? { readWitness: () => { guard(); return true; } } : undefined);
  guard();
  let json: Record<string, unknown> = {};
  try { json = pushConfigObject(await response.json()); } catch { /* Source malformed JSON becomes the request failure below. */ }
  guard();
  if (response.status !== 200 || !Object.keys(json).length) throw new MobileApiException({
    code: json.error == null ? 'push_config_request_failed' : dartJsonString(json.error),
    message: 'Push configuration request failed', statusCode: response.status,
  });
  return json;
}
/** @v2 adminPushConfig */
export async function adminPushConfig(session: Session, guard: Guard): Promise<AdminPushConfig> {
  const result = adminPushConfigFromJson(await request(session, 'GET', '', null, guard)); guard(); return result;
}
/** @v2 saveAdminPushConfig */
export async function saveAdminPushConfig(session: Session, account: Record<string, unknown>, guard: Guard): Promise<AdminPushConfig> {
  const result = adminPushConfigFromJson(await request(session, 'PUT', '', { service_account: account }, guard)); guard(); return result;
}
/** @v2 saveMobilePushConfig */
export async function saveMobilePushConfig(session: Session, platform: AdminPushConfigPlatform, config: FirebaseClientConfig, guard: Guard): Promise<AdminPushConfig> {
  const result = adminPushConfigFromJson(await request(session, 'PUT', '/mobile', { platform, config: {
    project_id: config.project_id, app_id: config.app_id, api_key: config.api_key, messaging_sender_id: config.messaging_sender_id, application_id: config.application_id,
  } }, guard)); guard(); return result;
}
/** @v2 checkAdminPushConfig */
export async function checkAdminPushConfig(session: Session, guard: Guard): Promise<AdminPushConfig> {
  const result = adminPushConfigFromJson(await request(session, 'POST', '/check', null, guard)); guard(); return result;
}
/** @v2 testAdminPushConfig */
export async function testAdminPushConfig(session: Session, token: string, guard: Guard): Promise<void> {
  const result = await request(session, 'POST', '/test', { token }, guard); guard();
  if (result.accepted_by_fcm !== true) throw new MobileApiException({ code: 'push_config_test_failed', message: 'FCM did not accept the test' });
}
