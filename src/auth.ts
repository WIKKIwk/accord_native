import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SavedAccountStore } from './savedAccountStore';
import { chunkedStorage } from './chunkedStorage';

export type Session = {
  token: string;
  profile: Record<string, unknown>;
  capabilities: string[];
  assigned_apparatus: string[];
  assigned_apparatus_labels: string[];
  assigned_item_groups?: string[];
  assigned_warehouses?: string[];
  werka_home?: Record<string, unknown> | null;
  baseUrl: string;
  imageCacheScope: string;
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
let savedAccountStore: SavedAccountStore | null = null;
const secureStorage = chunkedStorage({ getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value), removeItem: key => SecureStore.deleteItemAsync(key) });
const newImageCacheScope = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

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
    const profile = raw.profile as Record<string, unknown>;
    return {
      token: raw.token.trim(), baseUrl: normalizeServer(raw.baseUrl),
      profile, capabilities: strings(raw.capabilities),
      assigned_apparatus: strings(raw.assigned_apparatus), assigned_apparatus_labels: strings(raw.assigned_apparatus_labels),
      assigned_item_groups: strings(raw.assigned_item_groups),
      assigned_warehouses: strings(Array.isArray(raw.assigned_warehouses) ? raw.assigned_warehouses : profile.assigned_warehouses),
      werka_home: raw.werka_home && typeof raw.werka_home === 'object' && !Array.isArray(raw.werka_home)
        ? raw.werka_home as Record<string, unknown> : null,
      imageCacheScope: typeof raw.imageCacheScope === 'string' && raw.imageCacheScope ? raw.imageCacheScope : newImageCacheScope(),
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

function savedProfile(session: Session): Record<string, unknown> {
  return { ...session.profile, capabilities: session.capabilities, assigned_apparatus: session.assigned_apparatus,
    assigned_apparatus_labels: session.assigned_apparatus_labels, assigned_item_groups: session.assigned_item_groups ?? [],
    assigned_warehouses: session.assigned_warehouses ?? [] };
}

async function savedAccountsFor(baseUrl: string, previous: Session | null, credentials: Credentials | null) {
  const { initializeSavedAccounts } = await import('./savedAccountRuntime');
  let store: SavedAccountStore;
  try { store = await initializeSavedAccounts(baseUrl); }
  catch { savedAccountStore = null; return null; }
  savedAccountStore = store;
  if (previous && !store.activeAccountId) {
    const account = identity(previous);
    const same = credentials && credentials.baseUrl === previous.baseUrl && credentials.ref === account.ref && credentials.role === account.role;
    await store.upsertAuthenticated({ baseUrl: previous.baseUrl, profile: savedProfile(previous), token: previous.token,
      phone: same ? credentials.phone : String(previous.profile.phone ?? ''), code: same ? credentials.code : '', makeActive: true });
  }
  return store;
}

async function syncSavedProfile(session: Session): Promise<void> {
  const store = savedAccountStore, account = identity(session);
  const id = `${session.baseUrl}|${account.role}|${account.ref}`;
  if (store?.activeAccountId === id) await store.runAccountOperation(() => store.updateProfile(id, savedProfile(session)));
}

async function writeSession(session: Session): Promise<void> {
  if (Platform.OS === 'web') { webSession = session; return; }
  const { token, ...metadata } = session;
  await secureStorage.setItem(TOKEN_KEY, token);
  try { await secureStorage.setItem(SESSION_KEY, JSON.stringify(metadata)); }
  catch (error) { await secureStorage.removeItem(TOKEN_KEY); throw error; }
}
async function writeCredentials(credentials: Credentials): Promise<void> {
  if (Platform.OS === 'web') { webCredentials = credentials; return; }
  await secureStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
}
async function readCredentials(): Promise<Credentials | null> {
  if (Platform.OS === 'web') return webCredentials;
  try {
    const stored = await secureStorage.getItem(CREDENTIALS_KEY);
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
    if (epoch === sessionEpoch) {
      activeSession = session;
      await syncSavedProfile(session);
    }
  });
}

export async function loadSession(): Promise<Session | null> {
  const epoch = sessionEpoch;
  return inStorageOrder(async () => {
    if (epoch !== sessionEpoch) return null;
    if (activeSession) return activeSession;
    const { initializeServerEndpoints } = await import('./serverEndpointRuntime');
    const endpoints = await initializeServerEndpoints();
    if (epoch !== sessionEpoch) return null;
    let result: Session | null = null;
    if (Platform.OS === 'web') result = webSession;
    else {
      try {
        const [token, metadata] = await Promise.all([secureStorage.getItem(TOKEN_KEY), secureStorage.getItem(SESSION_KEY)]);
        if (token && metadata) {
          const stored = JSON.parse(metadata) as Record<string, unknown>;
          result = parseSession({ ...stored, token });
          if (result && !stored.imageCacheScope) {
            await secureStorage.setItem(SESSION_KEY, JSON.stringify({ ...stored, imageCacheScope: result.imageCacheScope })).catch(() => {});
          }
        }
      } catch { result = null; }
    }
    const credentials = await readCredentials();
    const store = await savedAccountsFor(result?.baseUrl ?? endpoints.baseUrl, result, credentials);
    const saved = store?.activeAccountId ? await store.sessionFor(store.activeAccountId) : null;
    if (epoch !== sessionEpoch) return null;
    if (saved) {
      const profile = saved.account.profile;
      const restored = parseSession({ ...profile, token: saved.token, profile, baseUrl: saved.account.base_url,
        imageCacheScope: result && result.baseUrl === saved.account.base_url && identity(result).ref === profile.ref && identity(result).role === profile.role
          ? result.imageCacheScope : newImageCacheScope() });
      if (restored && (!result || !sameIdentity(result, restored) || result.token !== restored.token)) {
        result = restored;
        const account = identity(restored);
        await writeCredentials({ baseUrl: restored.baseUrl, phone: saved.phone, code: saved.code, ...account });
        await writeSession(restored);
      }
    }
    if (epoch !== sessionEpoch) return null;
    activeSession = result;
    return result;
  });
}

const sessionResetHooks = new Set<() => Promise<void>>();

export function registerSessionResetHook(hook: () => Promise<void>): () => void {
  sessionResetHooks.add(hook);
  return () => { sessionResetHooks.delete(hook); };
}

async function resetForChangedProfile(previous: Session | null, next: Session): Promise<void> {
  if (!previous) return;
  const { sessionAccessRole } = await import('./shared/searchActivityStore');
  const key = (value: Session) => `${sessionAccessRole(value) ?? 'custom'}:${String(value.profile.ref ?? '')}`;
  if (key(previous) === key(next)) return;
  const results = await Promise.allSettled([...sessionResetHooks].map(hook => Promise.resolve().then(hook)));
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failure) throw failure.reason;
}

export async function clearSession(): Promise<void> {
  sessionEpoch++;
  activeSession = null;
  refreshing = null;
  const resets = Promise.allSettled([...sessionResetHooks].map(hook => Promise.resolve().then(hook)));
  const storage = inStorageOrder(async () => {
    webSession = null;
    webCredentials = null;
    if (Platform.OS !== 'web') await Promise.all([secureStorage.removeItem(TOKEN_KEY), secureStorage.removeItem(SESSION_KEY), secureStorage.removeItem(CREDENTIALS_KEY)]);
  });
  const [results] = await Promise.all([resets, storage]);
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failure) throw failure.reason;
}

export async function logout(session: Session): Promise<void> {
  if (activeSession !== session) return;
  const credentials = await inStorageOrder(readCredentials);
  const store = await savedAccountsFor(session.baseUrl, session, credentials);
  if (activeSession !== session) return;
  if (!store) {
    try {
      const { unregisterCurrentPushToken } = await import('./pushTokenRuntime');
      await unregisterCurrentPushToken(session);
    } catch { /* Push unregister is best-effort. */ }
    try {
      const { logoutSavedSession } = await import('./logoutSavedSession');
      await logoutSavedSession(session.token, session.baseUrl);
    } catch { /* Server logout is best-effort. */ }
    if (activeSession === session) await clearSession();
    return;
  }
  await store.runAccountOperation(async () => {
    try {
      const id = store.activeAccountId;
      const saved = id == null ? null : await store.sessionFor(id);
      try {
        const { unregisterCurrentPushToken } = await import('./pushTokenRuntime');
        await unregisterCurrentPushToken(session);
      } catch { /* Push unregister is best-effort. */ }
      if (saved) {
        try {
          const { logoutSavedSession } = await import('./logoutSavedSession');
          await logoutSavedSession(saved.token, saved.account.base_url);
        } catch { /* Server logout is best-effort. */ }
      }
      if (id != null) await store.remove(id);
    } finally {
      if (activeSession === session) await clearSession();
    }
  });
}

async function authenticate(server: string, phone: string, code: string): Promise<Session> {
  const { authenticateAccount } = await import('./authenticateAccount');
  const result = await authenticateAccount(server, phone, code);
  const session = parseSession({ ...result.profile, token: result.token, profile: result.profile,
    werka_home: result.werka_home, baseUrl: server, imageCacheScope: newImageCacheScope() });
  if (!session) throw new Error('Server noto‘g‘ri sessiya qaytardi.');
  return session;
}

/** @v2 login */
export async function login(baseUrl: string, phone: string, code: string): Promise<Session> {
  const server = normalizeServer(baseUrl);
  const normalizedPhone = phone.trim();
  const trimmedCode = code.trim();
  const epoch = ++sessionEpoch;
  const previousSession = activeSession;
  const { initializeServerEndpoints } = await import('./serverEndpointRuntime');
  const endpoints = await initializeServerEndpoints();
  if (epoch !== sessionEpoch) throw new Error('Sessiya o‘zgargan. Qayta kiring.');
  await endpoints.setBaseUrl(server);
  if (epoch !== sessionEpoch) throw new Error('Sessiya o‘zgargan. Qayta kiring.');
  const session = await authenticate(server, phone, code);
  const account = identity(session);
  if (!account.ref || !account.role) throw new Error('Server noto‘g‘ri hisob ma’lumotlarini qaytardi.');
  return inStorageOrder(async () => {
    if (epoch !== sessionEpoch) throw new Error('Sessiya o‘zgargan. Qayta kiring.');
    const previousCredentials = await readCredentials();
    const store = await savedAccountsFor(previousSession?.baseUrl ?? server, previousSession, previousCredentials);
    if (epoch !== sessionEpoch) { if (store) await store.clearActive(); throw new Error('Sessiya o‘zgargan. Qayta kiring.'); }
    const installSession = async () => {
      await resetForChangedProfile(previousSession, session);
      if (epoch !== sessionEpoch) throw new Error('Sessiya o‘zgargan. Qayta kiring.');
      await writeCredentials({ baseUrl: server, phone: normalizedPhone, code: trimmedCode, ...account });
      await writeSession(session);
      if (epoch !== sessionEpoch) throw new Error('Sessiya o‘zgargan. Qayta kiring.');
      activeSession = session;
      refreshing = null;
      return session;
    };
    const restoreSession = async (failures: unknown[]) => {
      if (epoch !== sessionEpoch) return;
      try {
        if (previousCredentials) await writeCredentials(previousCredentials);
        else if (Platform.OS === 'web') webCredentials = null;
        else await secureStorage.removeItem(CREDENTIALS_KEY);
        if (previousSession) await writeSession(previousSession);
        else if (Platform.OS === 'web') webSession = null;
        else await Promise.all([secureStorage.removeItem(TOKEN_KEY), secureStorage.removeItem(SESSION_KEY)]);
        activeSession = previousSession;
      } catch (failure) { failures.push(failure); }
    };
    if (!store) {
      try { return await installSession(); }
      catch (error) {
        const failures: unknown[] = [];
        await restoreSession(failures);
        if (failures.length) throw new Error(`Login failed and session rollback was incomplete: ${String(error)}; ${failures.map(String).join('; ')}`);
        throw error;
      }
    }
    return store.runAccountOperation(async () => {
      const previousId = store.activeAccountId;
      try {
        const saved = await store.upsertAuthenticated({ baseUrl: server, profile: savedProfile(session), token: session.token,
          phone, code, makeActive: false });
        if (epoch !== sessionEpoch) throw new Error('Sessiya o‘zgargan. Qayta kiring.');
        await store.activate(saved.id);
        if (epoch !== sessionEpoch) throw new Error('Sessiya o‘zgargan. Qayta kiring.');
        return await installSession();
      } catch (error) {
        const failures: unknown[] = [];
        try {
          if (previousId == null || epoch !== sessionEpoch) await store.clearActive();
          else if (store.activeAccountId !== previousId) await store.activate(previousId);
        } catch (failure) { failures.push(failure); }
        await restoreSession(failures);
        if (failures.length) throw new Error(`Login failed and session rollback was incomplete: ${String(error)}; ${failures.map(String).join('; ')}`);
        throw error;
      }
    });
  });
}

export function currentSession(): Session | null { return activeSession; }

/** Returns a token only while this exact login session is still active. */
export function activeSessionToken(session: Session): string | null {
  return activeSession === session ? session.token : null;
}

/** Keep a logged-in account's machine assignments in sync with its current profile. */
export function updateSessionAssignments(session: Session, assigned: readonly string[], labels: readonly string[]): boolean {
  if (activeSession !== session) return false;
  if (JSON.stringify(session.assigned_apparatus) === JSON.stringify(assigned) && JSON.stringify(session.assigned_apparatus_labels) === JSON.stringify(labels)) return true;
  session.assigned_apparatus = [...assigned];
  session.assigned_apparatus_labels = [...labels];
  const epoch = sessionEpoch;
  void inStorageOrder(async () => {
    if (activeSession !== session || epoch !== sessionEpoch) return;
    if (Platform.OS === 'web') webSession = session;
    else {
      const { token: _token, ...metadata } = session;
      await secureStorage.setItem(SESSION_KEY, JSON.stringify(metadata));
    }
    if (activeSession === session && epoch === sessionEpoch) await syncSavedProfile(session);
  }).catch(() => {});
  return true;
}

/** Refreshes an active session once for concurrent 401s. */
export async function refreshSession(session: Session, failedToken: string): Promise<boolean> {
  if (activeSession !== session) return false;
  if (session.token !== failedToken) return true;
  const epoch = sessionEpoch;
  if (refreshing?.session === session && refreshing.epoch === epoch) return refreshing.promise;
  const stillCurrent = () => activeSession === session && epoch === sessionEpoch;
  const promise = (async () => {
    try {
      const credentials = await inStorageOrder(readCredentials);
      if (!stillCurrent()) return false;
      const store = await savedAccountsFor(session.baseUrl, session, credentials);
      if (!stillCurrent()) return false;
      const applyRefresh = async (next: Session, phone: string, code: string): Promise<boolean> => {
        if (!stillCurrent()) return false;
        const changedIdentity = !sameIdentity(session, next);
        if (!changedIdentity) next.imageCacheScope = session.imageCacheScope;
        await resetForChangedProfile(session, next);
        if (!stillCurrent()) return false;
        return inStorageOrder(async () => {
          if (!stillCurrent()) return false;
          if (changedIdentity) await writeCredentials({ baseUrl: next.baseUrl, phone, code, ...identity(next) });
          await writeSession(next);
          if (!stillCurrent()) return false;
          Object.assign(session, next);
          return true;
        });
      };
      if (store) {
        return await store.runAccountOperation(async () => {
          if (!stillCurrent()) return false;
          const disconnect = async () => {
            if (!stillCurrent()) return;
            await store.clearActive();
            if (stillCurrent()) await clearSession();
          };
          const id = store.activeAccountId;
          const saved = id == null ? null : await store.sessionFor(id);
          if (!saved || !saved.phone || !saved.code) { await disconnect(); return false; }
          try {
            const next = await authenticate(saved.account.base_url, saved.phone, saved.code);
            if (!stillCurrent()) return false;
            await store.upsertAuthenticated({ baseUrl: next.baseUrl, profile: savedProfile(next), token: next.token,
              phone: saved.phone, code: saved.code, makeActive: true });
            return await applyRefresh(next, saved.phone, saved.code);
          } catch {
            await disconnect();
            return false;
          }
        });
      }
      const account = identity(session);
      if (!credentials || credentials.baseUrl !== session.baseUrl || credentials.ref !== account.ref ||
          credentials.role !== account.role || !credentials.phone || !credentials.code) return false;
      try {
        const next = await authenticate(credentials.baseUrl, credentials.phone, credentials.code);
        return await applyRefresh(next, credentials.phone, credentials.code);
      } catch {
        if (stillCurrent()) await clearSession();
        return false;
      }
    } catch { return false; }
  })();
  refreshing = { session, epoch, promise };
  try { return await promise; }
  finally { if (refreshing?.promise === promise) refreshing = null; }
}

type AccountRuntimeSnapshot = { session: Session | null; credentials: Promise<Credentials | null> };

/** @v2 createRuntimeAccountSwitchController */
export async function createRuntimeAccountSwitchController(baseUrl?: string) {
  const current = activeSession ?? await loadSession();
  const { initializeServerEndpoints } = await import('./serverEndpointRuntime');
  const endpoints = await initializeServerEndpoints();
  const server = normalizeServer(baseUrl ?? current?.baseUrl ?? endpoints.baseUrl);
  const credentials = await inStorageOrder(readCredentials);
  const store = await savedAccountsFor(server, current, credentials);
  if (!store) throw new Error('Saved account store is unavailable');
  const { AccountSwitchController } = await import('./shared/accountSwitchController');

  async function resetScopedState(): Promise<void> {
    const results = await Promise.allSettled([...sessionResetHooks].map(hook => Promise.resolve().then(hook)));
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
  async function install(session: Session, nextCredentials: Credentials | null): Promise<void> {
    const epoch = ++sessionEpoch;
    await resetScopedState();
    await inStorageOrder(async () => {
      if (epoch !== sessionEpoch) throw new Error('Sessiya o‘zgargan. Qayta kiring.');
      if (nextCredentials) await writeCredentials(nextCredentials);
      else if (Platform.OS === 'web') webCredentials = null;
      else await secureStorage.removeItem(CREDENTIALS_KEY);
      await writeSession(session);
      if (epoch !== sessionEpoch) throw new Error('Sessiya o‘zgargan. Qayta kiring.');
      activeSession = session;
      refreshing = null;
    });
  }

  return new AccountSwitchController(store, {
    current: () => activeSession,
    snapshot: (): AccountRuntimeSnapshot => ({ session: activeSession, credentials: inStorageOrder(readCredentials) }),
    restore: async snapshot => {
      const previous = snapshot as AccountRuntimeSnapshot;
      if (!previous.session) { await clearSession(); return; }
      await install(previous.session, await previous.credentials);
    },
    activate: async (target, werkaHomeBootstrap) => {
      const session = parseSession({ ...target.account.profile, profile: target.account.profile, token: target.token,
        baseUrl: target.account.base_url, werka_home: werkaHomeBootstrap, imageCacheScope: newImageCacheScope() });
      if (!session) throw new Error('Saved account session is invalid');
      const account = identity(session);
      await install(session, { baseUrl: session.baseUrl, phone: target.phone, code: target.code, ...account });
    },
    clear: clearSession,
    reauthenticate: async target => {
      const next = await authenticate(target.account.base_url, target.phone, target.code);
      return { token: next.token, profile: savedProfile(next), werkaHomeBootstrap: next.werka_home };
    },
    unregisterCurrentPush: async () => {
      if (!activeSession || activeSession.token === 'test-mode-token') return;
      const { unregisterCurrentPushToken } = await import('./pushTokenRuntime');
      await unregisterCurrentPushToken(activeSession);
    },
    logoutSavedSession: async target => {
      const { logoutSavedSession } = await import('./logoutSavedSession');
      await logoutSavedSession(target.token, target.account.base_url);
    },
    clearAfterLogout: async () => {
      if (!activeSession) return;
      const { clearAppLock } = await import('./appLock');
      await clearAppLock(activeSession);
      const { switchPinStore } = await import('./shared/switchPinRuntime');
      await switchPinStore.clear(activeSession);
    },
  });
}
