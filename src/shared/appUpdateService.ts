import type { AccountStorage } from '../savedAccountStore';
import { AppInstallationInfo, AppUpdateCheckResult, AppUpdateException, AppUpdateManifest, type PreparedAppUpdate } from './appUpdateModels';

export type DownloadStatus = 'missing' | 'pending' | 'running' | 'paused' | 'successful' | 'failed';
export type DownloadSnapshot = { status: DownloadStatus; receivedBytes: number; totalBytes: number; path: string; reason: number; retryable: boolean };
export type InstallResult = 'installer_launched' | 'permission_required';
export type UpdatePlatform = {
  isSupported: boolean;
  currentAppInfo(): Promise<AppInstallationInfo>;
  startOrAttachDownload(manifest: AppUpdateManifest): Promise<DownloadSnapshot>;
  queryDownload(manifest: AppUpdateManifest): Promise<DownloadSnapshot>;
  cancelDownload(manifest: AppUpdateManifest): Promise<void>;
  validateApk(path: string, packageName: string, versionCode: number): Promise<void>;
  installApk(path: string, packageName: string, versionCode: number): Promise<InstallResult>;
};
export type UpdateFiles = { exists(path: string): Promise<boolean>; size(path: string): Promise<number>; sha256(path: string): Promise<string> };
export type UpdateServiceOptions = { baseUrl: string | (() => string); storage: AccountStorage; platform: UpdatePlatform; files: UpdateFiles;
  fetch?: typeof fetch; socketFactory?: (url: string) => WebSocket; socketConnectTimeoutMs?: number;
  downloadPollIntervalMs?: number; automaticRetryDelayMs?: number };
type Progress = (received: number, total: number) => void;
const fail = (code: string, message: string) => new AppUpdateException(code, message);

/** @v2 AppUpdateDownloadSnapshot */
export function appUpdateDownloadSnapshotFromMap(map: Record<string, unknown>): DownloadSnapshot {
  const status = String(map.status ?? '');
  const number = (value: unknown) => {
    if (value == null) return 0;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid download number');
    return Math.trunc(value);
  };
  const receivedBytes = number(map.receivedBytes), totalBytes = number(map.totalBytes);
  if (!['missing', 'pending', 'running', 'paused', 'successful', 'failed'].includes(status) || receivedBytes < 0 || totalBytes < 0) {
    throw fail('invalid_download_state', 'Yangilanish yuklash holati noto‘g‘ri');
  }
  return { status: status as DownloadStatus, receivedBytes, totalBytes, path: String(map.path ?? '').trim(),
    reason: number(map.reason), retryable: map.retryable === true };
}

/** @v2 AppUpdateCancellation */
export class AppUpdateCancellation {
  private resolve!: () => void;
  readonly whenCancelled = new Promise<void>(resolve => { this.resolve = resolve; });
  isCancelled = false;
  constructor(readonly preserveDownload = false) {}
  cancel(): void { if (!this.isCancelled) { this.isCancelled = true; this.resolve(); } }
}

/** @v2 AppUpdateService */
export class AppUpdateService {
  private info: AppInstallationInfo | null = null;
  constructor(private readonly options: UpdateServiceOptions) {}
  private get base(): URL { return new URL(typeof this.options.baseUrl === 'function' ? this.options.baseUrl() : this.options.baseUrl); }
  get isSupported(): boolean { return this.options.platform.isSupported; }
  get endpointKey(): string { return this.base.origin; }
  private get cacheKey(): string { return `app_update_manifest_v1:${this.endpointKey}`; }
  /** @v2 AppUpdateService.releaseChanges */
  releaseChanges(onChange: () => void, onEnd: (error?: unknown) => void): () => void {
    const uri = new URL('/v1/mobile/app-update/android/live', this.base);
    uri.protocol = uri.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = (this.options.socketFactory ?? (url => new WebSocket(url)))(uri.toString());
    let stopped = false;
    const timeout = setTimeout(() => finish(new Error('Update connection timed out')), this.options.socketConnectTimeoutMs ?? 10_000);
    const finish = (error?: unknown) => {
      if (!stopped) { stopped = true; clearTimeout(timeout); socket.close(); onEnd(error); }
    };
    socket.onopen = () => clearTimeout(timeout);
    socket.onmessage = event => {
      if (stopped || typeof event.data !== 'string') return;
      let value: unknown;
      try {
        value = JSON.parse(event.data);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid update event');
      } catch (error) { finish(error); return; }
      if ((value as Record<string, unknown>).type === 'android_release_changed') onChange();
    };
    socket.onerror = event => finish(event);
    socket.onclose = () => finish();
    return () => { if (!stopped) { stopped = true; clearTimeout(timeout); socket.close(); } };
  }

  async rememberUpdate(update: AppUpdateCheckResult): Promise<void> {
    if (update.updateAvailable) await this.options.storage.setItem(this.cacheKey, JSON.stringify(update.manifest!.toJson()));
    else await this.options.storage.removeItem(this.cacheKey);
  }
  async restorePendingUpdate(): Promise<AppUpdateCheckResult | null> {
    const base = this.base, cacheKey = `app_update_manifest_v1:${base.origin}`;
    const encoded = await this.options.storage.getItem(cacheKey);
    if (encoded == null) return null;
    let manifest: AppUpdateManifest;
    try {
      const parsed: unknown = JSON.parse(encoded);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('Invalid manifest');
      manifest = AppUpdateManifest.fromJson(parsed as Record<string, unknown>, base.toString());
    } catch { await this.options.storage.removeItem(cacheKey); return null; }
    const result = new AppUpdateCheckResult(await this.currentAppInfo(), manifest);
    if (!result.updateAvailable) { await this.options.storage.removeItem(cacheKey); return null; }
    return result;
  }
  async currentAppInfo(): Promise<AppInstallationInfo> {
    if (this.info) return this.info;
    this.info = await this.timeout(this.options.platform.currentAppInfo(), 15_000, () => {
      const error = new Error('App info timed out'); error.name = 'TimeoutError'; return error;
    });
    return this.info;
  }
  async check(): Promise<AppUpdateCheckResult> {
    const base = this.base;
    const current = await this.currentAppInfo();
    const endpoint = new URL('/v1/mobile/app-update/android', base);
    let response: Response;
    try {
      response = await this.timeout((this.options.fetch ?? fetch)(endpoint.toString(), { method: 'GET' }), 15_000,
        () => fail('update_check_timeout', 'Yangilanish serveri javob bermadi'));
    } catch (error) {
      if (error instanceof AppUpdateException) throw error;
      if (error instanceof TypeError) throw fail('update_check_network', 'Yangilanish serveriga ulanib bo‘lmadi');
      throw error;
    }
    if (response.status === 204) return new AppUpdateCheckResult(current, null);
    if (response.status !== 200) throw fail('update_check_failed', `Yangilanish tekshirilmadi (${response.status})`);
    let body: Uint8Array;
    try { body = await this.readLimited(response); }
    catch (error) {
      if (error instanceof AppUpdateException) throw error;
      if (error instanceof TypeError) throw fail('update_check_network', 'Yangilanish serveri bilan aloqa uzildi');
      throw error;
    }
    let decoded: unknown;
    try { decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
    catch { throw fail('invalid_manifest', 'Update ma’lumoti noto‘g‘ri'); }
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw fail('invalid_manifest', 'Update ma’lumoti noto‘g‘ri');
    return new AppUpdateCheckResult(current, AppUpdateManifest.fromJson(decoded as Record<string, unknown>, base.toString()));
  }
  async downloadAndInstall(update: AppUpdateCheckResult, onProgress?: Progress, cancellation?: AppUpdateCancellation): Promise<InstallResult> {
    return this.installPreparedUpdate(await this.prepareUpdate(update, onProgress, cancellation));
  }
  async prepareUpdate(update: AppUpdateCheckResult, onProgress?: Progress, cancellation?: AppUpdateCancellation): Promise<PreparedAppUpdate> {
    if (!this.isSupported) throw fail('unsupported_platform', 'Bu qurilmada APK faylini o‘rnatib bo‘lmaydi');
    const manifest = update.manifest;
    if (!manifest || !update.updateAvailable) throw fail('no_update', 'Yangi versiya mavjud emas');
    if (manifest.sizeBytes > 512 * 1024 * 1024) throw fail('apk_too_large', 'APK hajmi ruxsat etilgan chegaradan katta');
    await this.rememberUpdate(update);
    const path = await this.download(manifest, onProgress, cancellation);
    if (!await this.options.files.exists(path) || await this.options.files.size(path) !== manifest.sizeBytes) {
      await this.options.platform.cancelDownload(manifest);
      throw fail('apk_size_mismatch', 'APK to‘liq yuklanmadi');
    }
    if (!await this.matchesManifest(path, manifest)) {
      await this.options.platform.cancelDownload(manifest);
      throw fail('apk_checksum_mismatch', 'APK xavfsizlik tekshiruvidan o‘tmadi');
    }
    onProgress?.(manifest.sizeBytes, manifest.sizeBytes);
    await this.options.platform.validateApk(path, update.current.packageName, manifest.versionCode);
    return { update, path };
  }
  async installPreparedUpdate(prepared: PreparedAppUpdate): Promise<InstallResult> {
    const manifest = prepared.update.manifest!;
    if (!await this.matchesManifest(prepared.path, manifest)) throw fail('prepared_apk_missing', 'Tayyor yangilanish qayta yuklanmoqda');
    return this.options.platform.installApk(prepared.path, prepared.update.current.packageName, manifest.versionCode);
  }
  async activeDownload(update: AppUpdateCheckResult): Promise<DownloadSnapshot | null> {
    if (!update.manifest || !update.updateAvailable) return null;
    const snapshot = await this.options.platform.queryDownload(update.manifest);
    return ['pending', 'running', 'paused', 'successful'].includes(snapshot.status) ? snapshot : null;
  }
  private async download(manifest: AppUpdateManifest, progress?: Progress, cancellation?: AppUpdateCancellation): Promise<string> {
    if (cancellation?.isCancelled) await this.cancelDownload(manifest, cancellation);
    let snapshot = await this.options.platform.startOrAttachDownload(manifest), retries = 0;
    while (true) {
      if (cancellation?.isCancelled) await this.cancelDownload(manifest, cancellation);
      progress?.(Math.max(0, Math.min(manifest.sizeBytes, snapshot.receivedBytes)), manifest.sizeBytes);
      if (snapshot.status === 'successful') {
        if (!snapshot.path) throw fail('download_file_missing', 'Yuklangan APK fayli topilmadi');
        return snapshot.path;
      }
      if (snapshot.status === 'failed' || snapshot.status === 'missing') {
        if (retries < 4 && (snapshot.status === 'missing' || snapshot.retryable)) {
          retries++; await this.options.platform.cancelDownload(manifest);
          const delay = Math.min(30_000, (this.options.automaticRetryDelayMs ?? 2000) * 2 ** Math.min(retries - 1, 3));
          await this.wait(delay, cancellation, manifest);
          snapshot = await this.options.platform.startOrAttachDownload(manifest); continue;
        }
        if (snapshot.reason === 1006) throw fail('insufficient_storage', 'Yangilanish uchun qurilmada bo‘sh joy yetarli emas');
        if (snapshot.reason === 404) throw fail('apk_not_found', 'Yangilanish APK fayli serverda topilmadi');
        throw fail('apk_download_failed', snapshot.reason > 0 ? `APK yuklanmadi (${snapshot.reason})` : 'APK yuklanmadi');
      }
      await this.wait(this.options.downloadPollIntervalMs ?? 750, cancellation, manifest);
      snapshot = await this.options.platform.queryDownload(manifest);
    }
  }
  private async wait(ms: number, cancellation: AppUpdateCancellation | undefined, manifest: AppUpdateManifest): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const delay = new Promise<void>(resolve => { timer = setTimeout(resolve, Math.max(0, ms)); });
      await (cancellation ? Promise.race([delay, cancellation.whenCancelled]) : delay);
    } finally { if (timer !== undefined) clearTimeout(timer); }
    if (cancellation?.isCancelled) await this.cancelDownload(manifest, cancellation);
  }
  private async cancelDownload(manifest: AppUpdateManifest, cancellation: AppUpdateCancellation): Promise<never> {
    if (!cancellation.preserveDownload) await this.options.platform.cancelDownload(manifest);
    throw fail('cancelled', 'Yangilanish bekor qilindi');
  }
  private async matchesManifest(path: string, manifest: AppUpdateManifest): Promise<boolean> {
    try {
      return await this.options.files.exists(path) && await this.options.files.size(path) === manifest.sizeBytes &&
        (await this.options.files.sha256(path)).toLowerCase() === manifest.sha256;
    } catch { throw fail('update_storage_failed', 'Yuklangan APK faylini o‘qib bo‘lmadi'); }
  }
  private async readLimited(response: Response): Promise<Uint8Array> {
    if (!response.body) return new Uint8Array();
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const part = await this.timeout(reader.read(), 15_000, () => fail('update_check_timeout', 'Yangilanish serveri javobi tugamadi'));
        if (part.done) break;
        length += part.value.length;
        if (length > 128 * 1024) throw fail('manifest_too_large', 'Server javobi juda katta');
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const body = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    return body;
  }
  private async timeout<T>(promise: Promise<T>, ms: number, error: () => Error): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(error()), ms); })]); }
    finally { if (timer !== undefined) clearTimeout(timer); }
  }
}
