type Obj = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);
function integer(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid update number');
  return Math.trunc(value);
}

/** @v2 AppUpdateException */
export class AppUpdateException extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

/** @v2 AppInstallationInfo */
export class AppInstallationInfo {
  constructor(readonly packageName: string, readonly versionCode: number, readonly versionName: string, readonly signerSha256: string) {}
  static fromMap(map: Obj): AppInstallationInfo {
    return new AppInstallationInfo(text(map.packageName).trim(), integer(map.versionCode),
      text(map.versionName).trim(), text(map.signerSha256).trim().toLowerCase());
  }
}

/** @v2 AppUpdateManifest */
export class AppUpdateManifest {
  constructor(readonly versionCode: number, readonly versionName: string, readonly minimumSupportedVersionCode: number,
    readonly mandatory: boolean, readonly apkUri: string, readonly sha256: string, readonly sizeBytes: number,
    readonly releaseNotes: string, readonly publishedAt: string) {}
  get artifactKey(): string { return `${this.versionCode}:${this.sha256}:${this.sizeBytes}:${this.apkUri}`; }
  static fromJson(json: Obj, baseUri: string): AppUpdateManifest {
    const versionCode = integer(json.version_code), versionName = text(json.version_name).trim();
    const minimumVersion = integer(json.minimum_supported_version_code), rawUrl = text(json.apk_url).trim();
    const sha256 = text(json.sha256).trim().toLowerCase(), sizeBytes = integer(json.size_bytes);
    let uri: URL | null = null;
    try { uri = new URL(rawUrl, baseUri); } catch { /* Invalid URI is rejected below. */ }
    if (versionCode <= 0 || !versionName || minimumVersion < 0 || minimumVersion > versionCode || !rawUrl ||
        !uri || !['https:', 'http:'].includes(uri.protocol) || !/^[a-f0-9]{64}$/.test(sha256) || sizeBytes <= 0) {
      throw new AppUpdateException('invalid_manifest', 'Update ma’lumoti noto‘g‘ri');
    }
    return new AppUpdateManifest(versionCode, versionName, minimumVersion, json.mandatory === true, uri.toString(), sha256,
      sizeBytes, text(json.release_notes).trim(), text(json.published_at).trim());
  }
  isNewerThan(current: AppInstallationInfo): boolean { return this.versionCode > current.versionCode; }
  isMandatoryFor(current: AppInstallationInfo): boolean { return this.mandatory || current.versionCode < this.minimumSupportedVersionCode; }
  toJson(): Obj {
    return { version_code: this.versionCode, version_name: this.versionName,
      minimum_supported_version_code: this.minimumSupportedVersionCode, mandatory: this.mandatory, apk_url: this.apkUri,
      sha256: this.sha256, size_bytes: this.sizeBytes, release_notes: this.releaseNotes, published_at: this.publishedAt };
  }
}

/** @v2 AppUpdateCheckResult */
export class AppUpdateCheckResult {
  constructor(readonly current: AppInstallationInfo, readonly manifest: AppUpdateManifest | null) {}
  get updateAvailable(): boolean { return !!this.manifest && this.manifest.isNewerThan(this.current); }
  get mandatory(): boolean { return this.updateAvailable && !!this.manifest?.isMandatoryFor(this.current); }
}

/** @v2 PreparedAppUpdate */
export type PreparedAppUpdate = { update: AppUpdateCheckResult; path: string };
