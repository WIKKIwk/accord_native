import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { WorkerControlException } from './workerControlsApi';
async function requireSuccess(response: Response, fallback: string): Promise<void> {
  if (response.status >= 200 && response.status < 300) return;
  let data: unknown; try { data = await response.json(); } catch { data = null; }
  const value = data && typeof data === 'object' && !Array.isArray(data) ? (data as { error?: unknown }).error : null;
  throw new WorkerControlException(value == null ? fallback : String(value), 'Chat so‘rovi bajarilmadi', response.status);
}
/** @v2 chatRegisterDeviceToken */
export async function chatRegisterDeviceToken(session: Session, tokenValue: string, platform: string) {
  const response = await authorizedFetch(session, '/v1/mobile/chat/device-token', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: tokenValue.trim(), platform }) });
  await requireSuccess(response, 'chat_device_register_failed');
}
/** @v2 chatUnregisterDeviceToken */
export async function chatUnregisterDeviceToken(session: Session, tokenValue: string) {
  const token = activeSessionToken(session); if (token == null || !token) return;
  const query = new URLSearchParams({ token: tokenValue.trim() }), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${session.baseUrl}/v1/mobile/chat/device-token?${query}`, { method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    await requireSuccess(response, 'chat_device_unregister_failed');
  } finally { clearTimeout(timer); }
}
