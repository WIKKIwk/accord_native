import type { Session } from '../auth';
import { authorizedFetch,isAuthorizedLegacyClientFailure,isAuthorizedLegacyTimeout } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { adminProductionResponsePayload } from './adminProductionRequest';
/** @v2 adminDeleteOpeningWipBatch / _sendOpeningWipDeleteWithRetry */
export async function adminDeleteOpeningWipBatch(session:Session,batchId:string,guard:()=>void) {
  const id = batchId.trim(); if (!id) throw new MobileApiException({ code:'opening_wip_invalid_input',message:'Opening WIP ma’lumotlari to‘liq emas' });
  for (let attempt=0;attempt<2;attempt++) {
    guard(); let response:Response;
    try { response = await authorizedFetch(session,`/v1/mobile/admin/production-maps/opening-wip?${new URLSearchParams({ batch_id:id })}`,{ method:'DELETE' },guard); }
    catch (error) {
      guard(); const timeout = isAuthorizedLegacyTimeout(error), client = isAuthorizedLegacyClientFailure(error);
      if (!timeout && !client) throw error; if (!attempt) continue;
      const message = error instanceof Error ? error.message.trim() : '';
      throw new MobileApiException({ code:timeout ? 'opening_wip_delete_timeout' : 'opening_wip_delete_transport',message:timeout ? message ? `Server javobi vaqtida kelmadi. Opening WIP holatini yangilab qayta tekshiring: ${message}` : 'Server javobi vaqtida kelmadi. Opening WIP holatini yangilab qayta tekshiring.' : `Server javobi olinmadi. Opening WIP holatini yangilab qayta tekshiring: ${message}` });
    }
    guard(); if (response.status !== 200) await adminProductionResponsePayload(response,'opening_wip_delete',guard); return;
  }
}
