import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { WorkerControlException } from './workerControlsApi';
export type FirebaseClientConfig = { project_id: string; app_id: string; api_key: string; messaging_sender_id: string; application_id: string };
/** @v2 mobilePushConfig */
export async function mobilePushConfig(session: Session, platform: string): Promise<FirebaseClientConfig | null> {
  const response = await authorizedFetch(session, '/v1/mobile/push-config', { headers: { 'Content-Type': 'application/json' } });
  let raw: unknown; try { raw = await response.json(); } catch { raw = null; }
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  if (response.status !== 200 || !Object.keys(data).length)
    throw new WorkerControlException(data.error == null ? 'push_config_request_failed' : String(data.error), 'Push configuration request failed', response.status);
  if (data[platform] == null) return null;
  const value = data[platform];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid Firebase client configuration');
  const row = value as Record<string, unknown>, keys = ['project_id', 'app_id', 'api_key', 'messaging_sender_id', 'application_id'] as const;
  if (keys.some(key => typeof row[key] !== 'string')) throw new TypeError('Invalid Firebase client configuration');
  const config = Object.fromEntries(keys.map(key => [key, row[key]])) as FirebaseClientConfig;
  const application = platform === 'ios' ? 'com.example.accordMobileV2.mirsaid.uzkingshark' : 'com.example.accord_mobile_v2';
  const prefix = `1:${config.messaging_sender_id}:${platform}:`;
  if (!['ios', 'android'].includes(platform) || config.application_id !== application || !/^[a-z0-9-]{1,64}$/.test(config.project_id) ||
      !/^[0-9]{1,32}$/.test(config.messaging_sender_id) || !config.app_id.startsWith(prefix) || config.app_id.length <= prefix.length ||
      config.app_id.length > 200 || !/^AIza[A-Za-z0-9_-]{1,196}$/.test(config.api_key)) throw new TypeError('Invalid Firebase client configuration');
  return config;
}
