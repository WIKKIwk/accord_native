import { useEffect, useRef } from 'react';
import { isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import type { BoyoqchiRequestsController } from './boyoqchiController';
import { BoyoqchiForm } from './BoyoqchiForm';
import { completeReturnedPaint } from './returnedPaintApi';
import { ReturnedPaintReconciliationError, returnedPaintDraftContentSnapshot, verifyReturnedPaintCompletion } from './returnedPaintCompletion';
import { returnedPaintDraftStoreFor } from './returnedPaintDraftRuntime';
import type { ReturnedPaintRequest } from './returnedPaintModel';

export function useReturnedPaintForm(session: Session, controller: BoyoqchiRequestsController, witness: SessionWitness) {
  const sheet = useNativeSheet(), opening = useRef(false), busy = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return async (request: ReturnedPaintRequest) => {
    if (!mounted.current || witness.session !== session || !isSessionWitnessCurrent(witness) ||
        opening.current || busy.current || sheet.isOpen()) return;
    opening.current = true;
    try {
      const store = returnedPaintDraftStoreFor(session, witness);
      const draft = await store.load(request.id, request.image);
      if (!mounted.current || !isSessionWitnessCurrent(witness) || !store.isCurrent()) return;
      const isCurrentScope = () => mounted.current && isSessionWitnessCurrent(witness) && store.isCurrent();
      const content = <BoyoqchiForm session={session} draft={draft} close={() => { if (isCurrentScope()) sheet.close(); }}
        onBusyChange={value => { if (isCurrentScope()) { busy.current = value; sheet.update(content, { dismissible: !value }); } }}
        save={async items => {
          const isCurrent = isCurrentScope;
          const ensureCurrent = () => { if (!isCurrent()) throw new Error('Sessiya tugagan. Qayta kiring.'); };
          const input = { request_id: request.id, items };
          ensureCurrent();
          const submittedDraft = returnedPaintDraftContentSnapshot(draft);
          try {
            await completeReturnedPaint(session, input, { beforeSend: ensureCurrent,
              verifyResponse: body => verifyReturnedPaintCompletion(body, input) });
          } catch (failure) {
            if (!isCurrent()) throw failure;
            if (failure instanceof Error && failure.name === 'BoyoqchiDemoUnavailableError') throw failure;
            if (failure instanceof Error && failure.name === 'MobileApiException' &&
                'statusCode' in failure && typeof failure.statusCode === 'number' &&
                failure.statusCode >= 400 && failure.statusCode < 500 && failure.statusCode !== 408) throw failure;
            throw new ReturnedPaintReconciliationError();
          }
          ensureCurrent();
          if (submittedDraft !== returnedPaintDraftContentSnapshot(draft)) throw new ReturnedPaintReconciliationError();
          try { await store.clear(request.id); } catch { throw new ReturnedPaintReconciliationError(); }
          ensureCurrent();
          if (submittedDraft !== returnedPaintDraftContentSnapshot(draft)) {
            try { await store.flush(request.id); } catch { /* Keep the in-memory draft; reconciliation is required. */ }
            throw new ReturnedPaintReconciliationError();
          }
          if (isCurrent()) {
            try { await controller.refresh(); } catch { /* The server write was already confirmed; refresh can be retried separately. */ }
          }
        }} />;
      sheet.open(content, { dismissible: true });
    } finally { opening.current = false; }
  };
}
