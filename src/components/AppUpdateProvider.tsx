import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppUpdatePresenter } from '../shared/appUpdateCoordinator';
import { appUpdateCoordinator } from '../shared/appUpdateIntegration';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useBaseTheme } from './useBaseTheme';

const UpdateContext = createContext<(() => void) | null>(null);
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<'manual' | 'ready' | null>(null);
  const [, setRevision] = useState(0);
  const resolveDialog = useRef<(() => void) | null>(null);
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const theme = useBaseTheme();
  const t = (key: string) => localizedGetter(key, locale);
  const presenter = useMemo<AppUpdatePresenter>(() => {
    const open = (kind: 'manual' | 'ready') => new Promise<void>(resolve => {
      resolveDialog.current = resolve; setDialog(kind);
      if (kind === 'manual') void appUpdateCoordinator.refresh();
    });
    return { showManual: () => open('manual'), showReady: () => open('ready') };
  }, []);
  useEffect(() => appUpdateCoordinator.subscribe(() => setRevision(value => value + 1)), []);
  useEffect(() => () => { resolveDialog.current?.(); resolveDialog.current = null; }, []);
  const open = useCallback(() => { void appUpdateCoordinator.checkAndPrompt(presenter, true); }, [presenter]);
  const close = () => {
    if (dialog === 'ready' && appUpdateCoordinator.ready?.update.mandatory) return;
    setDialog(null); resolveDialog.current?.(); resolveDialog.current = null;
  };
  const result = appUpdateCoordinator.latest;
  const latest = result && !result.updateAvailable;
  const title = t(latest ? 'appUpdateCurrentTitle' : result?.updateAvailable ? 'appUpdateAvailableTitle' : 'appUpdateSettingsTitle');
  const unavailable = ({ uz: 'Bu ilova versiyasida yangilashni o‘rnatib bo‘lmaydi.',
    en: 'This version of the app cannot install the update.', ru: 'Эта версия приложения не может установить обновление.',
    ur: 'ایپ کا یہ ورژن اپ ڈیٹ انسٹال نہیں کر سکتا۔' } as Record<string, string>)[locale.split('-')[0]];
  return <UpdateContext.Provider value={open}>{children}
    <Modal visible={dialog !== null} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}><View style={[styles.dialog, { backgroundColor: theme.colors.surfaceContainerHigh ?? (theme.mode === 'dark' ? '#2c2c2e' : '#ffffff') }]}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
        {appUpdateCoordinator.current ? <Text style={{ color: theme.colors.onSurface }}>{t('appUpdateInstalledVersion')}: {appUpdateCoordinator.current.versionName} ({appUpdateCoordinator.current.versionCode})</Text> : null}
        {result?.manifest ? <Text style={{ color: theme.colors.onSurface }}>{t('appUpdateLatestVersion')}: {result.manifest.versionName} ({result.manifest.versionCode})</Text> : null}
        {appUpdateCoordinator.checking ? <><ActivityIndicator /><Text style={{ color: theme.colors.onSurface }}>{t('checking')}</Text></> :
          appUpdateCoordinator.error ? <Text style={{ color: theme.colors.onSurface }}>{appUpdateCoordinator.error}</Text> :
            latest ? <Text style={{ color: theme.colors.onSurface }}>{t('appUpdateCurrent')}</Text> :
              result?.updateAvailable ? <Text style={{ color: theme.colors.onSurface }}>{Platform.OS === 'android' ? unavailable : t('appUpdateUnsupported')}</Text> : null}
        {appUpdateCoordinator.error ? <Pressable accessibilityRole="button" onPress={() => { void appUpdateCoordinator.refresh(); }}><Text style={[styles.action, { color: theme.colors.primary ?? theme.seed }]}>{t('retry')}</Text></Pressable> : null}
        {appUpdateCoordinator.ready ? <Pressable accessibilityRole="button" onPress={() => { void appUpdateCoordinator.installReady().catch(() => Alert.alert(t('appUpdateDownloadFailed'))); }}><Text style={[styles.action, { color: theme.colors.primary ?? theme.seed }]}>{t('appUpdateAction')}</Text></Pressable> : null}
        {!appUpdateCoordinator.ready?.update.mandatory ? <Pressable accessibilityRole="button" onPress={close}><Text style={[styles.action, { color: theme.colors.primary ?? theme.seed }]}>{t('closeAction')}</Text></Pressable> : null}
      </View></View>
    </Modal>
  </UpdateContext.Provider>;
}

export function useAppUpdate(): () => void {
  const value = useContext(UpdateContext);
  if (!value) throw new Error('Update presenter is unavailable');
  return value;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 24, padding: 24, gap: 14 }, title: { fontSize: 20, fontWeight: '700' },
  action: { fontSize: 16, fontWeight: '600', paddingVertical: 8, textAlign: 'right' },
});
