import { localeController } from './localization/runtime';
import { themeController } from './themeRuntime';

let loading: Promise<void> | null = null;

export function initializeBasePreferences(): Promise<void> {
  if (loading) return loading;
  const pending = Promise.all([themeController.load(), localeController.load()]).then(() => undefined);
  loading = pending;
  void pending.catch(() => { if (loading === pending) loading = null; });
  return pending;
}
