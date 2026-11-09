import type { PermissionResponse } from 'expo-camera';

type PermissionMethod = () => Promise<PermissionResponse>;
type Snapshot = { permission: PermissionResponse | null; error: unknown | null; checking: boolean };

// A previous owner's native prompt cannot be cancelled; later owners wait for it to finish.
let permissionQueue: Promise<void> = Promise.resolve();

/** Serialize OS permission operations and ignore completions from an older owner or request. */
export class CameraPermissionController {
  private snapshot: Snapshot = { permission: null, error: null, checking: false };
  private listeners = new Set<() => void>();
  private active = false;
  private owner = 0;
  private newest = 0;
  constructor(private readonly get: PermissionMethod, private readonly request: PermissionMethod) {}
  getSnapshot = (): Snapshot => this.snapshot;
  canUseCamera = (): boolean => this.active && !this.snapshot.checking && this.snapshot.permission?.granted === true && this.snapshot.error === null;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private update(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener());
  }
  mount(): void {
    this.active = true; this.owner++;
    // Reading permission does not request it; the caller controls all requests.
    void this.refreshPermission().catch(() => {});
  }
  unmount(): void { this.active = false; this.owner++; this.newest++; }
  private run(method: PermissionMethod): Promise<PermissionResponse> {
    if (!this.active) return Promise.reject(new Error('Camera permission owner inactive'));
    const owner = this.owner, revision = ++this.newest;
    this.update({ permission: null, error: null, checking: true });
    const operation = permissionQueue.then(() => {
      if (!this.active || this.owner !== owner) throw new Error('Camera permission owner inactive');
      return method();
    });
    permissionQueue = operation.then(() => undefined, () => undefined);
    return operation.then(value => {
      if (this.active && this.owner === owner && this.newest === revision) this.update({ permission: value, error: null, checking: false });
      return value;
    }, error => {
      if (this.active && this.owner === owner && this.newest === revision) this.update({ permission: null, error, checking: false });
      throw error;
    });
  }
  refreshPermission = (): Promise<PermissionResponse> => this.run(this.get);
  requestPermission = (): Promise<PermissionResponse> => this.run(this.request);
}
