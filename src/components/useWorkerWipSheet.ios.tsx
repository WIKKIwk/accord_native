import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { NativeSheetOptions } from '../nativeSheet';
import { WorkerOrderSheet } from './WorkerOrderSheet';
import { WorkerSheetCloseContext } from './workerSheetContext';

type Owner = { id: number; isClosing: () => boolean; requestClose: () => void; attachClose: (close: (() => void) | null) => () => void };
type Presentation = { owner: Owner; content: ReactNode; options: NativeSheetOptions };

function createOwner(id: number): Owner {
  let closing = false, nativeClose: (() => void) | null = null;
  return { id, isClosing: () => closing,
    requestClose() { if (!closing) { closing = true; nativeClose?.(); } },
    attachClose(close) {
      nativeClose = close;
      if (closing) close?.();
      return () => { if (nativeClose === close) nativeClose = null; };
    },
  };
}

function WipSheetContent({ owner, children }: { owner: Owner; children: ReactNode }) {
  const close = useContext(WorkerSheetCloseContext);
  useLayoutEffect(() => owner.attachClose(close), [owner, close]);
  return children;
}

/** SwiftUI child sheets must be presented inside their parent's content, without pushing a route. */
export function useWorkerWipSheet() {
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const current = useRef<Presentation | null>(null), mounted = useRef(true), nextId = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => { if (!mounted.current) current.current = null; });
    };
  }, []);
  const sheet = useMemo(() => ({
    open(content: ReactNode, options: NativeSheetOptions = {}) {
      if (!mounted.current || current.current) return;
      const next = { owner: createOwner(++nextId.current), content, options };
      current.current = next; setPresentation(next);
    },
    update(content: ReactNode, options?: NativeSheetOptions) {
      const previous = current.current;
      if (!mounted.current || !previous || previous.owner.isClosing()) return;
      const next = { ...previous, content, options: options ? { ...previous.options, ...options } : previous.options };
      current.current = next; setPresentation(next);
    },
    close() {
      const previous = current.current;
      if (previous) previous.owner.requestClose();
    },
    isOpen: () => current.current !== null,
  }), []);
  const dismissed = (owner: Owner) => {
    if (!mounted.current || current.current?.owner !== owner) return;
    const callback = current.current.options.onDismiss;
    current.current = null; setPresentation(null); callback?.();
  };
  return { sheet, dialogs: presentation ? <WorkerOrderSheet key={presentation.owner.id}
    dismissible={presentation.options.dismissible} compact={presentation.options.compact}
    fitContent={presentation.options.fitContent} heightFraction={presentation.options.heightFraction}
    onClose={() => dismissed(presentation.owner)}>
    <WipSheetContent owner={presentation.owner}>{presentation.content}</WipSheetContent>
  </WorkerOrderSheet> : null };
}
