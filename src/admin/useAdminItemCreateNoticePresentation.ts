import { useLayoutEffect, useMemo } from 'react';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminItemCreateFixedSnackBarTarget } from './AdminItemCreateScreenAssemblyTypes';
import type { AdminItemCreateNotice } from './adminItemCreateModel';
import type { AdminTopNoticeMessenger } from './adminTopNoticeMessenger';
import { adminTopNoticeService } from './adminTopNoticeRuntime';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

/** Resolve ONCE when the source controller publishes the notice, never again on locale/render changes. */
function message(notice: AdminItemCreateNotice): string {
  const locale = localeController.locale;
  return notice.literal ?? (notice.getter ? localizedGetter(notice.getter, locale) : notice.key ? adminText(notice.key, locale, notice.values) : '');
}
export function useAdminItemCreateNoticePresentation(model: AdminItemCreateScreenModel, messenger: AdminTopNoticeMessenger, fixed: AdminItemCreateFixedSnackBarTarget): void {
  const { owner, current } = model, seen = useMemo(() => ({ owner, notices: new WeakSet<AdminItemCreateNotice>() }), [owner]);
  useLayoutEffect(() => {
    let attached = true;
    const publish = () => {
      if (!attached || !current()) return;
      const state = owner.controller.getSnapshot();
      for (const notice of [state.form.notice, state.list.notice]) {
        if (!notice || seen.notices.has(notice) || !current()) continue;
        // An original notice is a one-shot Source call, even when native readiness
        // is lost. Re-render/replay must not resurrect or retranslate the message.
        seen.notices.add(notice); const resolved = message(notice); if (!attached || !current()) return;
        if (notice.surface === 'top') adminTopNoticeService.show(messenger, { message: resolved, tone: notice.tone });
        else if (isSynchronouslyTrue(fixed.isAvailable) && attached && current()) fixed.enqueue(Object.freeze({ identity: notice, message: resolved }));
      }
    };
    const stop = owner.controller.subscribe(publish); publish();
    return () => { attached = false; stop(); };
  }, [owner, current, messenger, fixed, seen]);
}
