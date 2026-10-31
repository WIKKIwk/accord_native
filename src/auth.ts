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

type Credentials = { baseUrl: string; phone: string; code: string; ref: string; role: string };
export const DEFAULT_SERVER_URL = 'https://mini-rs-erp-test.wspace.sbs';
const TOKEN_KEY = 'accord_v4_token';
const SESSION_KEY = 'accord_v4_session';
const CREDENTIALS_KEY = 'accord_v4_credentials';
let webSession: Session | null = null;
let webCredentials: Credentials | null = null;
let activeSession: Session | null = null;
let sessionEpoch = 0;
let storageQueue: Promise<void> = Promise.resolve();
let refreshing: { session: Session; epoch: number; promise: Promise<boolean> } | null = null;

function inStorageOrder<T>(action: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(action);
  storageQueue = result.then(() => undefined, () => undefined);
  return result;
}

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

function identity(session: Session): { ref: string; role: string } {
  return { ref: String(session.profile.ref ?? '').trim(), role: String(session.profile.role ?? '').trim() };
}
function sameIdentity(a: Session, b: Session): boolean {
  const x = identity(a); const y = identity(b);
  return !!x.ref && !!x.role && a.baseUrl === b.baseUrl && x.ref === y.ref && x.role === y.role;
}

async function writeSession(session: Session): Promise<void> {
  if (Platform.OS === 'web') { webSession = session; return; }
  const { token, ...metadata } = session;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  try { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(metadata)); }
  catch (error) { await SecureStore.deleteItemAsync(TOKEN_KEY); throw error; }
}
async function writeCredentials(credentials: Credentials): Promise<void> {
  if (Platform.OS === 'web') { webCredentials = credentials; return; }
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials));
}
async function readCredentials(): Promise<Credentials | null> {
  if (Platform.OS === 'web') return webCredentials;
  try {
    const stored = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    if (!stored) return null;
    const value = JSON.parse(stored) as Record<string, unknown>;
    if (typeof value.baseUrl !== 'string' || typeof value.phone !== 'string' || typeof value.code !== 'string' || typeof value.ref !== 'string' || typeof value.role !== 'string') return null;
    return { baseUrl: value.baseUrl, phone: value.phone, code: value.code, ref: value.ref, role: value.role };
  } catch { return null; }
}

export async function saveSession(session: Session): Promise<void> {
  const epoch = sessionEpoch;
  await inStorageOrder(async () => {
    if (epoch !== sessionEpoch) return;
    await writeSession(session);
    if (epoch === sessionEpoch) activeSession = session;
  });
}

export async function loadSession(): Promise<Session | null> {
  const epoch = sessionEpoch;
  return inStorageOrder(async () => {
    if (epoch !== sessionEpoch) return null;
    if (activeSession) return activeSession;
    let result: Session | null = null;
    if (Platform.OS === 'web') result = webSession;
    else {
      try {
        const [token, metadata] = await Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(SESSION_KEY)]);
        if (token && metadata) result = parseSession({ ...JSON.parse(metadata), token });
      } catch { result = null; }
    }
    if (epoch !== sessionEpoch) return null;
    activeSession = result;
    return result;
  });
}

export async function clearSession(): Promise<void> {
  sessionEpoch++;
  activeSession = null;
  refreshing = null;
  await inStorageOrder(async () => {
    webSession = null;
    webCredentials = null;
    if (Platform.OS !== 'web') await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(SESSION_KEY), SecureStore.deleteItemAsync(CREDENTIALS_KEY)]);
  });
}

export async function logout(session: Session): Promise<void> {
  if (activeSession !== session) return;
  const token = session.token;
  const baseUrl = session.baseUrl;
  const clear = clearSession(); // Invalidate in-flight requests before awaiting the network.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(`${baseUrl}/v1/mobile/auth/logout`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    });
  } catch {
    // Local sign-out remains available if the server cannot be reached.
  } finally {
    clearTimeout(timer);
    await clear;
  }
}

async function authenticate(server: string, phone: string, code: string): Promise<Session> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(`${server}/v1/mobile/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }), signal: controller.signal,
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
  return session;
}

export async function login(baseUrl: string, phone: string, code: string): Promise<Session> {
  const server = normalizeServer(baseUrl);
  const normalizedPhone = phone.trim();
  const trimmedCode = code.trim();
  if (!normalizedPhone || !trimmedCode) throw new Error('Telefon raqam va kodni kiriting.');
  const epoch = ++sessionEpoch;
  activeSession = null;
  refreshing = null;
  const session = await authenticate(server, normalizedPhone, trimmedCode);
  const account = identity(session);
  if (!account.ref || !account.role) throw new Error('Server noto‘g‘ri hisob ma’lumotlarini qaytardi.');
  return inStorageOrder(async () => {
    if (epoch !== sessionEpoch) throw new Error('Sessiya o‘zgargan. Qayta kiring.');
    await writeCredentials({ baseUrl: server, phone: normalizedPhone, code: trimmedCode, ...account });
    await writeSession(session);
    if (epoch !== sessionEpoch) throw new Error('Sessiya o‘zgargan. Qayta kiring.');
    activeSession = session;
    return session;
  });
}

/** Returns a token only while this exact login session is still active. */
export function activeSessionToken(session: Session): string | null {
  return activeSession === session ? session.token : null;
}

/** Refreshes an active session once for concurrent 401s; network errors retain local state. */
export async function refreshSession(session: Session, failedToken: string): Promise<boolean> {
  if (activeSession !== session) return false;
  if (session.token !== failedToken) return true;
  const epoch = sessionEpoch;
  if (refreshing?.session === session && refreshing.epoch === epoch) return refreshing.promise;
  const promise = (async () => {
    try {
      const credentials = await inStorageOrder(readCredentials);
      if (activeSession !== session || epoch !== sessionEpoch || !credentials) return false;
      const account = identity(session);
      if (credentials.baseUrl !== session.baseUrl || credentials.ref !== account.ref || credentials.role !== account.role || !credentials.phone || !credentials.code) return false;
      const next = await authenticate(credentials.baseUrl, credentials.phone, credentials.code);
      if (!sameIdentity(session, next)) return false;
      return await inStorageOrder(async () => {
        if (activeSession !== session || epoch !== sessionEpoch) return false;
        await writeSession(next);
        if (activeSession !== session || epoch !== sessionEpoch) return false;
        Object.assign(session, next);
        return true;
      });
    } catch { return false; }
  })();
  refreshing = { session, epoch, promise };
  try { return await promise; }
  finally { if (refreshing?.promise === promise) refreshing = null; }
}
