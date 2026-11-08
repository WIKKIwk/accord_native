import { useEffect, useRef } from 'react';
import type { Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import type { BoyoqchiRequestsController } from './boyoqchiController';
import { BoyoqchiForm } from './BoyoqchiForm';
import { completeReturnedPaint } from './returnedPaintApi';
import { ReturnedPaintReconciliationError, verifyReturnedPaintCompletion } from './returnedPaintCompletion';
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
          const ensureCurrent = () => { if (!store.isCurrent()) throw new Error('Sessiya tugagan. Qayta kiring.'); };
          const input = { request_id: request.id, items };
          ensureCurrent();
          try {
            await completeReturnedPaint(session, input, { beforeSend: ensureCurrent,
              verifyResponse: body => verifyReturnedPaintCompletion(body, input) });
          } catch (failure) {
            if (!store.isCurrent()) throw failure;
            if (failure instanceof Error && failure.name === 'MobileApiException' &&
                'statusCode' in failure && typeof failure.statusCode === 'number' &&
                failure.statusCode >= 400 && failure.statusCode < 500 && failure.statusCode !== 408) throw failure;
            throw new ReturnedPaintReconciliationError();
          }
          ensureCurrent();
          try { await store.clear(request.id); } catch { throw new ReturnedPaintReconciliationError(); }
          if (store.isCurrent()) {
            try { await controller.refresh(); } catch { /* The server write was already confirmed; refresh can be retried separately. */ }
          }
        }} />;
      sheet.open(content, { dismissible: true });
    } finally { opening.current = false; }
  };
}
