import type { CameraView, PermissionResponse } from 'expo-camera';
import { dartFutureTimeout } from '../shared/dartFutureTimeout';

class CameraStartCancelled extends Error {}

type Phase = 'idle' | 'starting' | 'recovering' | 'running' | 'stopping' | 'suspended' | 'error' | 'disposed';
type State = { wanted: boolean; ready: boolean; generation: number; error: unknown; phase: Phase };
/** @v2 ReliableScannerSession: real native readiness, two starts, 8s start / 4s release timeouts. */
export class BrigaderCameraSession {
  private state: State = { wanted: false, ready: false, generation: 0, error: null, phase: 'idle' };
  private listeners = new Set<() => void>();
  private handle: CameraView | null = null;
  private committed = false;
  private leases = 0;
  private retired = false;
  private permission: PermissionResponse | null = null;
  private permissionError: unknown = null;
  private previousBarcode: string | null = null;
  private nextDetection = 0;
  private request = 0;
  private attempts = 0;
  private recovering = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private starting: { resolve: () => void; reject: (error: unknown) => void }[] = [];
  private stopped: (() => void)[] = [];
  constructor(private readonly original: () => boolean, private readonly platform: 'android' | 'ios', private readonly detectionSpeed: 'normal' | 'noDuplicates' = 'noDuplicates') {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  current = () => !this.retired && this.leases > 0 && this.original();
  private patch(change: Partial<State>) { if (!this.retired) { this.state = { ...this.state, ...change }; this.listeners.forEach(listener => listener()); } }
  private clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
  mount() { this.leases++; return () => { this.leases--; queueMicrotask(() => { if (!this.leases) this.dispose(); }); }; }
  permissionChanged(permission: PermissionResponse | null, error: unknown) {
    this.permission = permission; this.permissionError = error;
    if (this.state.wanted && (error || permission && !permission.granted)) this.failed(error ?? new Error('Camera permission denied'));
  }
  acceptBarcode(raw: string) {
    if (!this.current() || !this.state.ready || !this.state.wanted) return false;
    if (this.platform === 'android' && this.detectionSpeed === 'noDuplicates') {
      if (this.previousBarcode === raw) return false;
      this.previousBarcode = raw; return true;
    }
    const now = performance.now(); if (now < this.nextDetection) return false;
    this.nextDetection = now + 250; return true;
  }
  private startAttempt() {
    this.previousBarcode = null; this.nextDetection = 0;
    this.patch({ wanted: true, ready: false, error: null, generation: this.state.generation + 1, phase: this.attempts ? 'recovering' : 'starting' });
    // Permission prompts are completed by the permission owner before starting, and have no timeout.
    if (this.permission?.granted) this.timer = setTimeout(() => this.failed(new Error('Scanner start timed out')), 8000);
  }
  start = (): Promise<void> => {
    if (!this.current()) return Promise.reject(new Error('Camera owner expired'));
    if (this.permissionError || this.permission && !this.permission.granted) return Promise.reject(this.permissionError ?? new Error('Camera permission denied'));
    if (this.state.ready && this.state.wanted && this.handle) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.starting.push({ resolve, reject });
      if (this.starting.length === 1 && !this.recovering) { this.request++; this.attempts = 0; this.startAttempt(); }
    });
  };
  private async release() {
    const handle = this.handle;
    const detached = !this.committed ? Promise.resolve() : new Promise<void>(resolve => this.stopped.push(resolve));
    this.patch({ wanted: false, ready: false });
    // A real ref/layout detach resolves this promise; timing out never acknowledges native removal.
    await dartFutureTimeout(Promise.all([handle ? handle.pausePreview().catch(() => {}) : Promise.resolve(), detached]), 4000);
  }
  stop = async () => {
    const request = ++this.request; this.clearTimer(); this.recovering = false;
    this.starting.splice(0).forEach(item => item.reject(new CameraStartCancelled('Camera start cancelled')));
    this.patch({ phase: 'stopping' });
    try { await this.release(); } catch { /* Source records release failure and still suspends. */ }
    if (this.current() && request === this.request) this.patch({ phase: 'suspended' });
  };
  nativeRef = (handle: CameraView | null) => { this.handle = handle; if (handle && !this.state.wanted) void handle.pausePreview().catch(() => {}); };
  committedActive(active: boolean) { this.committed = active; if (!active) this.stopped.splice(0).forEach(resolve => resolve()); }
  ready = () => {
    if (!this.current() || !this.state.wanted || !this.handle || !this.permission?.granted) return;
    this.clearTimer(); this.patch({ ready: true, error: null, phase: 'running' }); this.starting.splice(0).forEach(item => item.resolve());
  };
  failed = (error: unknown) => {
    if (!this.current() || this.recovering || error instanceof CameraStartCancelled) return;
    if (this.state.wanted) void this.recover(error);
    else this.patch({ error,ready:false,phase:'error' });
  };
  private async recover(error: unknown) {
    this.clearTimer(); this.recovering = true; const request = this.request;
    if (this.attempts === 0 && this.permission?.granted && !this.permissionError) {
      this.attempts++; this.patch({ phase: 'recovering' });
      try { await this.release(); } catch { /* Source retries after a failed release too. */ }
      if (!this.current() || request !== this.request) return;
      this.recovering = false;
      if (!this.permission?.granted || this.permissionError) { this.patch({ wanted:false,ready:false,error:this.permissionError ?? error,phase:'error' }); this.starting.splice(0).forEach(item => item.reject(this.permissionError ?? error)); return; }
      this.startAttempt(); return;
    }
    this.recovering = false; this.patch({ ready: false, wanted: false, error, phase: 'error' });
    this.starting.splice(0).forEach(item => item.reject(error));
  }
  dispose() {
    if (this.retired) return;
    this.request++; this.clearTimer(); this.retired = true;
    this.state = { ...this.state, wanted: false, ready: false, phase: 'disposed' };
    const handle = this.handle; this.handle = null; if (handle) void handle.pausePreview().catch(() => {});
    this.starting.splice(0).forEach(item => item.reject(new Error('Camera owner retired')));
    this.stopped.splice(0).forEach(resolve => resolve()); this.listeners.clear();
  }
}
