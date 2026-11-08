import { NativeModule, requireOptionalNativeModule } from 'expo';

export type NativeChatSocketEvent = { session: string; type: 'open' | 'message' | 'error' | 'close'; value: string };

declare class NativeAccordChatSecure extends NativeModule<{ onChatSocket: (event: NativeChatSocketEvent) => void }> {
  open(origin: string, ticket: string): string;
  send(id: string, value: string): boolean;
  stop(id: string): void;
}

export function chatSecureNativeModule(): NativeAccordChatSecure | null {
  return requireOptionalNativeModule<NativeAccordChatSecure>('AccordChatSecure');
}
