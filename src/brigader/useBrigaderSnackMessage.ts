import { useCallback } from 'react';
import { useOptionalAdminFixedSnackBarContext } from '../admin/AdminFixedSnackBarProvider';
/** Source hideCurrentSnackBar followed by showSnackBar, on the actual account Messenger. */
export function useBrigaderSnackMessage(current: () => boolean, replace = true, fallback?: (message: string) => void) {
  const fixed = useOptionalAdminFixedSnackBarContext();
  const queue = fixed?.queue, target = fixed?.target;
  const show = useCallback((message: string) => {
    if (!current()) return;
    if (!queue || !target) { fallback?.(message); return; }
    const head = queue.getSnapshot().head;
    if (replace && head) queue.hide(head);
    target.enqueue({ identity: {}, message });
  }, [queue, target, current, replace, fallback]);
  if (!fixed && !fallback) throw Error('The genuine AdminFixedSnackBarProvider is required');
  return show;
}
