import type { Session, SessionWitness } from '../auth';
import type { AdminPushConfigFile, AdminPushConfigPlatform } from './adminPushConfigModel';

export type AdminPushConfigDeviceSnapshot = { status: string; errorDetail: string | null };
/** A real Firebase registration owner must retain the original account through every native/network operation. */
export type AdminPushConfigDevice = {
  getSnapshot: () => AdminPushConfigDeviceSnapshot;
  subscribe: (listener: () => void) => () => void;
  initialize: (guard: () => void) => Promise<void>;
  prepareConfigurationTest: (guard: () => void) => Promise<string>;
};
export type AdminPushConfigScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean;
  device: AdminPushConfigDevice;
  backLabel: string; onBack: () => void;
  /** Source's explicit test-token provider avoids device initialization after load/client upload. */
  deviceTokenProvider?: (guard: () => void) => Promise<string>;
  pickFile?: (kind: 'account' | AdminPushConfigPlatform, guard: () => void) => Promise<AdminPushConfigFile | null>;
};
