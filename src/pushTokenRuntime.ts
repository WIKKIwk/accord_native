import type { Session } from './auth';

type PushTokenReader = () => Promise<string | null>;
let currentReader: PushTokenReader | null = null;

// The native Firebase bridge supplies a reader only after it is initialized.
export function registerPushTokenReader(reader: PushTokenReader): () => void {
  currentReader = reader;
  return () => { if (currentReader === reader) currentReader = null; };
}

export async function unregisterCurrentPushToken(session: Session): Promise<void> {
  const token = await currentReader?.();
  if (!token?.trim()) return;
  const { chatUnregisterDeviceToken } = await import('./chatDeviceTokenApi');
  await chatUnregisterDeviceToken(session, token);
}
