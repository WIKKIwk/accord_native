import { useCallback } from 'react';
import { useAdminFixedSnackBarContext } from '../admin/AdminFixedSnackBarProvider';
/** Source hideCurrentSnackBar followed by showSnackBar, on the actual account Messenger. */
export function useBrigaderSnackMessage(current:()=>boolean) {
  const { queue,target } = useAdminFixedSnackBarContext();
  return useCallback((message:string) => { if (!current()) return; const head = queue.getSnapshot().head; if (head) queue.hide(head); target.enqueue({ identity:{},message }); },[queue,target,current]);
}
