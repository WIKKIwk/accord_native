import { SECURE_CHAT_UNAVAILABLE, secureChatAvailable } from './chatSecureSocket';

export const SECURE_CHAT_AUTH_UNAVAILABLE = 'Xavfsiz Chat aloqasi hozircha mavjud emas.';

/** The socket prototype is not deployable until secure ticket/401 handling is resolved. */
export function secureChatUnavailableReason(): string | null {
  return secureChatAvailable() ? SECURE_CHAT_AUTH_UNAVAILABLE : SECURE_CHAT_UNAVAILABLE;
}
