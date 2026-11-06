import { requireOptionalNativeModule } from 'expo';
import Constants, { AppOwnership } from 'expo-constants';
import { appPreferences } from '../appPreferences';
import { MobileApi } from '../mobileApi';
import { AppUpdateCoordinator } from './appUpdateCoordinator';
import { installedAppInfo } from './appUpdateNativeInfo';
import { AppUpdateService } from './appUpdateService';

type NativeApplication = { applicationId?: string | null; nativeApplicationVersion?: string | null; nativeBuildVersion?: string | null };

const service = new AppUpdateService({
  baseUrl: () => MobileApi.instance.baseUrl,
  storage: appPreferences,
  platform: {
    isSupported: false,
    currentAppInfo: async () => installedAppInfo(Constants.appOwnership === AppOwnership.Expo
      ? null : requireOptionalNativeModule<NativeApplication>('ExpoApplication')),
  },
});

export const appUpdateCoordinator = new AppUpdateCoordinator(service);
