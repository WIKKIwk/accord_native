import { randomUUID } from 'expo-crypto';

/** Capture once per original native window. No JS/HMR counter or fallback can reuse a native ticket. */
export function createAdminPresentationWindowTicket(): string {
  const uuid = randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) throw Error('Native presentation requires a genuine unique ticket');
  return `admin-window-${uuid}`;
}
