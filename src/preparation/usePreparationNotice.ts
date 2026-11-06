import { useCallback, useEffect, useRef, useState } from 'react';

export function usePreparationNotice() {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); };
  }, []);
  const show = useCallback((text: string) => {
    if (!mounted.current) return;
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => { timer.current = null; setMessage(''); }, 4000);
  }, []);
  return { message, show };
}
