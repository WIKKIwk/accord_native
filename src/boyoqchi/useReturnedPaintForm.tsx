import { useEffect, useRef } from 'react';
import type { Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import type { BoyoqchiRequestsController } from './boyoqchiController';
import { BoyoqchiForm } from './BoyoqchiForm';
import { completeReturnedPaint } from './returnedPaintApi';
import { returnedPaintDraftStoreFor } from './returnedPaintDraftRuntime';
import type { ReturnedPaintRequest } from './returnedPaintModel';

export function useReturnedPaintForm(session: Session, controller: BoyoqchiRequestsController) {
  const sheet = useNativeSheet(), opening = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return async (request: ReturnedPaintRequest) => {
    if (opening.current || sheet.isOpen()) return;
    opening.current = true;
    try {
      const store = returnedPaintDraftStoreFor(session);
      const draft = await store.load(request.id, request.image);
      if (!mounted.current || !store.isCurrent()) return;
      const content = <BoyoqchiForm session={session} draft={draft} close={() => sheet.close()}
        onBusyChange={busy => sheet.update(content, { dismissible: !busy })}
        save={async items => {
          await completeReturnedPaint(session, { request_id: request.id, items });
          await store.clear(request.id);
          if (store.isCurrent()) await controller.refresh(true);
        }} />;
      sheet.open(content, { dismissible: true });
    } finally { opening.current = false; }
  };
}
