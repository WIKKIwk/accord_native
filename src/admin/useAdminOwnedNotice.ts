import { useCallback, useEffect, useRef, useState } from 'react';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

export function useAdminOwnedNotice(isCurrent: () => boolean) {
  const serial = useRef(0), [notice, setNotice] = useState<{ serial: number; message: string } | null>(null);
  const show = useCallback((message: string) => { if (isSynchronouslyTrue(isCurrent)) setNotice({ serial: ++serial.current, message }); }, [isCurrent]);
  useEffect(() => { if (!notice) return; const original = notice, timer = setTimeout(() => { if (isSynchronouslyTrue(isCurrent)) setNotice(value => value === original ? null : value); }, 4000);
    return () => clearTimeout(timer); }, [notice, isCurrent]);
  return { notice, show };
}
