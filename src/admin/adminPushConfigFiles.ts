import { DOMParser, type Element as XmlElement } from '@xmldom/xmldom';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { FirebaseClientConfig } from '../mobilePushConfigApi';
import { MobileApiException } from '../shared/mobileApiException';
import { dartJsonString } from './dartJsonString';
import { adminPushConfigClientFromJson, pushConfigObject, type AdminPushConfigFile, type AdminPushConfigPlatform } from './adminPushConfigModel';

/** These are the selected V2 Firebase file identities, not inferred from an uploaded filename. */
export const adminPushConfigApplication = { android: 'com.example.accord_mobile_v2', ios: 'com.example.accordMobileV2.mirsaid.uzkingshark' } as const;

/** @v2 FirebaseClientConfig.validate */
export function validateAdminPushConfigClient(config: FirebaseClientConfig, platform: AdminPushConfigPlatform): void {
  const prefix = `1:${config.messaging_sender_id}:${platform}:`;
  if (!['ios', 'android'].includes(platform) || config.application_id !== adminPushConfigApplication[platform] ||
    !/^[a-z0-9-]{1,64}$/.test(config.project_id) || !/^[0-9]{1,32}$/.test(config.messaging_sender_id) ||
    !config.app_id.startsWith(prefix) || config.app_id.length <= prefix.length || config.app_id.length > 200 ||
    !/^AIza[A-Za-z0-9_-]{1,196}$/.test(config.api_key)) throw new TypeError('Invalid Firebase client configuration');
}

/** @v2 FirebaseClientConfig.fromFile */
export function parseAdminPushConfigClientFile(raw: string, platform: AdminPushConfigPlatform): FirebaseClientConfig {
  if (new TextEncoder().encode(raw).length > 131072) throw new TypeError('File too large');
  let config: FirebaseClientConfig;
  if (platform === 'android') {
    const json = pushConfigObject(JSON.parse(raw)), project = pushConfigObject(json.project_info);
    if (!Array.isArray(json.client)) throw new TypeError('Invalid Firebase clients');
    let selected: Record<string, unknown> | null = null;
    for (const value of json.client) {
      const client = pushConfigObject(value), info = client.client_info == null ? null : pushConfigObject(client.client_info),
        android = info?.android_client_info == null ? null : pushConfigObject(info.android_client_info);
      if (android?.package_name === adminPushConfigApplication.android) { selected = client; break; }
    }
    if (!selected || !Array.isArray(selected.api_key) || !selected.api_key.length) throw new TypeError('Matching Firebase client missing');
    const info = pushConfigObject(selected.client_info), android = pushConfigObject(info.android_client_info), key = pushConfigObject(selected.api_key[0]);
    config = adminPushConfigClientFromJson({ project_id: project.project_id, app_id: info.mobilesdk_app_id,
      api_key: key.current_key, messaging_sender_id: dartJsonString(project.project_number ?? null), application_id: android.package_name });
  } else if (platform === 'ios') {
    const fail = () => { throw new TypeError('Invalid Firebase plist'); };
    const document = new DOMParser({ onError: fail }).parseFromString(raw, 'application/xml');
    const dict = document.getElementsByTagName('dict').item(0);
    if (!dict) throw new TypeError('Firebase plist dictionary missing');
    const children = Array.from(dict.childNodes).filter(node => node.nodeType === 1) as XmlElement[], values: Record<string, string> = {};
    for (let i = 0; i + 1 < children.length; i += 2) {
      if (children[i].localName === 'key' && children[i + 1].localName === 'string') {
        values[children[i].textContent ?? ''] = children[i + 1].textContent ?? '';
      }
    }
    config = { project_id: values.PROJECT_ID ?? '', app_id: values.GOOGLE_APP_ID ?? '', api_key: values.API_KEY ?? '',
      messaging_sender_id: values.GCM_SENDER_ID ?? '', application_id: values.BUNDLE_ID ?? '' };
  } else throw new TypeError('Unsupported platform');
  validateAdminPushConfigClient(config, platform); return config;
}

export function readAdminPushConfigClientFile(file: AdminPushConfigFile, platform: AdminPushConfigPlatform): FirebaseClientConfig {
  try {
    if (file.size > 131072 || !file.bytes) throw new TypeError('Invalid client file');
    return parseAdminPushConfigClientFile(new TextDecoder('utf-8', { fatal: true }).decode(file.bytes), platform);
  } catch { throw new MobileApiException({ code: 'push_config_invalid_client_config', message: 'Invalid client file' }); }
}

/** Uses the installed native picker and reads its cache copy; no path is sent to the server. */
export async function pickAdminPushConfigFile(kind: 'account' | AdminPushConfigPlatform, guard: () => void): Promise<AdminPushConfigFile | null> {
  guard();
  const result = await DocumentPicker.getDocumentAsync({ type: kind === 'ios' ? ['application/x-plist', 'application/xml', 'text/xml'] : 'application/json',
    copyToCacheDirectory: true, multiple: false });
  guard(); if (result.canceled) return null;
  if (result.assets.length !== 1) throw new TypeError('Expected one Firebase file');
  const asset = result.assets[0], bytes = await new File(asset.uri).bytes(); guard();
  return { name: asset.name, size: asset.size ?? bytes.byteLength, bytes };
}
