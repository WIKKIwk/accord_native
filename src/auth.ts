import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type Session = {
  token: string;
  profile: Record<string, unknown>;
  capabilities: string[];
  assigned_apparatus: string[];
  assigned_apparatus_labels: string[];
  baseUrl: string;
};

export const DEFAULT_SERVER_URL = 'https://mini-rs-erp-test.wspace.sbs';
const TOKEN_KEY = 'accord_v4_token';
const SESSION_KEY = 'accord_v4_session';
let webSession: Session | null = null;

function normalizeServer(raw: string): string {
  let value = raw.trim();
  if (!value.includes('://')) value = `https://${value}`;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Server manzili noto‘g‘ri.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    throw new Error('Server manzilini HTTPS bilan, qo‘shimcha yo‘lsiz kiriting.');
  }
  return url.origin;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

function parseSession(value: unknown): Session | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.token !== 'string' || !raw.token.trim() || typeof raw.baseUrl !== 'string' || !raw.profile || typeof raw.profile !== 'object' || Array.isArray(raw.profile)) return null;
  try {
    return {
      token: raw.token.trim(), baseUrl: normalizeServer(raw.baseUrl),
      profile: raw.profile as Record<string, unknown>, capabilities: strings(raw.capabilities),
      assigned_apparatus: strings(raw.assigned_apparatus), assigned_apparatus_labels: strings(raw.assigned_apparatus_labels),
    };
  } catch { return null; }
}

export async function saveSession(session: Session): Promise<void> {
  if (Platform.OS === 'web') { webSession = session; return; }
  const { token, ...metadata } = session;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  try { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(metadata)); }
  catch (error) { await SecureStore.deleteItemAsync(TOKEN_KEY); throw error; }
}

export async function loadSession(): Promise<Session | null> {
  if (Platform.OS === 'web') return webSession;
  try {
    const [token, metadata] = await Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(SESSION_KEY)]);
    if (!token || !metadata) return null;
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    return parseSession({ ...parsed, token });
  } catch { return null; }
}

export async function clearSession(): Promise<void> {
  webSession = null;
  if (Platform.OS !== 'web') await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(SESSION_KEY)]);
}

export async function login(baseUrl: string, phone: string, code: string): Promise<Session> {
  const server = normalizeServer(baseUrl);
  const normalizedPhone = phone.trim();
  const trimmedCode = code.trim();
  if (!normalizedPhone || !trimmedCode) throw new Error('Telefon raqam va kodni kiriting.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(`${server}/v1/mobile/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone, code: trimmedCode }), signal: controller.signal,
    });
  } catch {
    throw new Error('Serverga ulanib bo‘lmadi. Manzil va internetni tekshiring.');
  } finally { clearTimeout(timer); }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Telefon raqam yoki kod noto‘g‘ri.');
    if (response.status === 429) throw new Error('Urinishlar soni ko‘p. Birozdan so‘ng qayta urinib ko‘ring.');
    throw new Error(`Server xatosi (${response.status}). Qayta urinib ko‘ring.`);
  }
  let body: Record<string, unknown>;
  try { body = await response.json() as Record<string, unknown>; }
  catch { throw new Error('Server javobini o‘qib bo‘lmadi.'); }
  const session = parseSession({ ...body, baseUrl: server });
  if (!session) throw new Error('Server noto‘g‘ri sessiya qaytardi.');
  await saveSession(session);
  return session;
}
