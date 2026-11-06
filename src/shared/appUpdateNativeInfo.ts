import { AppInstallationInfo, AppUpdateException } from './appUpdateModels';

type NativeApplicationInfo = { applicationId?: string | null; nativeApplicationVersion?: string | null; nativeBuildVersion?: string | null };

/** @v2 NativeAppUpdatePlatform.currentAppInfo */
export function installedAppInfo(native: NativeApplicationInfo | null): AppInstallationInfo {
  const packageName = native?.applicationId?.trim() ?? '';
  const versionName = native?.nativeApplicationVersion?.trim() ?? '';
  const build = native?.nativeBuildVersion?.trim() ?? '';
  const versionCode = /^\d+$/.test(build) ? Number(build) : 0;
  if (!packageName || !versionName || !Number.isSafeInteger(versionCode) || versionCode <= 0) {
    throw new AppUpdateException('app_info_failed', 'Ilova versiyasi aniqlanmadi');
  }
  return new AppInstallationInfo(packageName, versionCode, versionName, '');
}
