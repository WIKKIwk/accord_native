import type { Session } from '../auth';
import type { ChatPeer } from '../chatModel';
import { MobileApiException } from '../shared/mobileApiException';
import type { AdminUserListEntry } from './adminUsersModel';
import { dartTrim } from './dartJsonString';

/** @v2 _adminChatTarget */
export function adminProfileChatTarget(session: Session, entry: AdminUserListEntry | null): ChatPeer | null {
  if (!entry) return null; const ref = dartTrim(entry.id); if (!ref) return null;
  const currentRef = typeof session.profile.ref === 'string' ? dartTrim(session.profile.ref) : '';
  if (session.profile.role === entry.principal_role && currentRef === ref) return null;
  return Object.freeze({ role: entry.principal_role, ref, displayName: entry.name, avatarUrl: entry.avatar_url });
}
export class AdminProfileChatTransportFailure extends Error {
  constructor(readonly reason: 'network' | 'timeout') { super(reason); this.name = 'AdminProfileChatTransportFailure'; }
}
/** @v2 chatFailureMessage */
export function adminProfileChatFailureMessage(error: unknown): string {
  if (error instanceof AdminProfileChatTransportFailure) return 'Ulanish uzildi. Internetni tekshirib, qayta yuboring.';
  if (!(error instanceof MobileApiException)) return 'Xabar yuborilmadi. Qayta urinib ko‘ring.';
  const messages: Record<string, string> = {
    authentication_required: 'Sessiya muddati tugagan. Qayta kirib ko‘ring.', chat_forbidden: 'Bu suhbatga xabar yuborish ruxsati yo‘q.',
    chat_not_found: 'Suhbat topilmadi. Chatlar ro‘yxatini yangilang.', chat_input_invalid: 'Xabar bo‘sh yoki juda uzun.',
    chat_state_conflict: 'Bu media avval yuborilgan yoki endi yuborib bo‘lmaydi.', chat_media_too_large: 'Rasm 15 MiB, video esa 2 GiB dan oshmasligi kerak.',
    chat_media_input_invalid: 'Media fayl formati yaroqsiz yoki qo‘llab-quvvatlanmaydi.', invalid_media_content: 'Media fayl formati yaroqsiz yoki qo‘llab-quvvatlanmaydi.',
    video_duration_too_long: 'Video 10 daqiqa (600 soniya)dan oshmasligi kerak.', audio_duration_too_long: 'Ovozli xabar 10 daqiqa (600 soniya)dan oshmasligi kerak.',
    video_resolution_too_large: 'Video o‘lchami 1920×1080 dan oshmasligi kerak.', video_frame_rate_too_high: 'Video tezligi 60 FPS dan oshmasligi kerak.',
    processed_video_too_large: 'Qayta ishlangan video 1 GiB dan oshib ketdi.', processed_audio_too_large: 'Qayta ishlangan ovozli xabar 64 MiB dan oshib ketdi.',
    chat_media_forbidden: 'Bu suhbatga media yuborish ruxsati yo‘q.', chat_media_state_conflict: 'Media yuklash holati o‘zgargan. Qayta urinib ko‘ring.',
    processor_unavailable: 'Media qayta ishlash xizmati hozir mavjud emas.', chat_media_unavailable: 'Media qayta ishlash xizmati hozir mavjud emas.',
    media_processing_failed: 'Media fayl qayta ishlanmadi. Qayta urinib ko‘ring.', chat_media_processing_failed: 'Media fayl qayta ishlanmadi. Qayta urinib ko‘ring.',
    chat_media_storage_failed: 'Media serverda saqlanmadi. Qayta urinib ko‘ring.', chat_media_store_failed: 'Media serverda saqlanmadi. Qayta urinib ko‘ring.',
    chat_unavailable: 'Chat serveri vaqtincha javob bermayapti.', chat_store_failed: 'Chat serveri vaqtincha javob bermayapti.',
  };
  if (Object.hasOwn(messages, error.code)) return messages[error.code];
  if (error.statusCode === 429) return 'Juda ko‘p urinish bo‘ldi. Birozdan keyin qayta yuboring.';
  if (error.statusCode !== null && error.statusCode >= 500) return 'Server xatosi. Xabar saqlandi, qayta yuborishingiz mumkin.';
  return error.message;
}
