import { useEffect, useRef } from 'react';
import type { Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import type { BoyoqchiRequestsController } from './boyoqchiController';
import { BoyoqchiForm } from './BoyoqchiForm';
import { completeReturnedPaint } from './returnedPaintApi';
import { returnedPaintDraftStore } from './returnedPaintDraftRuntime';
import type { ReturnedPaintRequest } from './returnedPaintModel';
import { returnedPaintBoyoqchiDraftScope } from './returnedPaintRules';

export function useReturnedPaintForm(session: Session, controller: BoyoqchiRequestsController) {
  const sheet = useNativeSheet(), opening = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return async (request: ReturnedPaintRequest) => {
    if (opening.current || sheet.isOpen()) return;
    opening.current = true;
    try {
      const scope = returnedPaintBoyoqchiDraftScope(typeof session.profile.ref === 'string' ? session.profile.ref : '', request.id);
      const draft = await returnedPaintDraftStore.load(scope, request.image);
      if (!mounted.current) return;
      const content = <BoyoqchiForm session={session} draft={draft} close={() => sheet.close()}
        onBusyChange={busy => sheet.update(content, { dismissible: !busy })}
        save={async items => {
          await completeReturnedPaint(session, { request_id: request.id, items });
          await returnedPaintDraftStore.clear(scope);
          await controller.refresh(true);
        }} />;
      sheet.open(content, { dismissible: true });
    } finally { opening.current = false; }
  };
}
