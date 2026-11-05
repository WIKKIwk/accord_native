import { appPreferences } from './appPreferences';
import { DEFAULT_SERVER_URL, ServerEndpointStore } from './serverEndpointStore';

const compiledBaseUrl = process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL ?? DEFAULT_SERVER_URL;
export const serverEndpointStore = new ServerEndpointStore(appPreferences, compiledBaseUrl);
let initialization: Promise<ServerEndpointStore> | null = null;

export function initializeServerEndpoints(): Promise<ServerEndpointStore> {
  if (initialization) return initialization;
  const pending = serverEndpointStore.load().then(() => serverEndpointStore);
  initialization = pending;
  void pending.catch(() => { if (initialization === pending) initialization = null; });
  return pending;
}
