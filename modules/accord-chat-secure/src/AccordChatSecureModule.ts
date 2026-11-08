import { NativeModule, requireOptionalNativeModule } from 'expo';

export type NativeChatSocketEvent = { session: number; type: 'open' | 'message' | 'error' | 'close'; value: string };

declare class NativeAccordChatSecure extends NativeModule<{ onChatSocket: (event: NativeChatSocketEvent) => void }> {
  open(id: number, origin: string, ticket: string): void;
  send(id: number, value: string): boolean;
  stop(id: number): void;
}

export function chatSecureNativeModule(): NativeAccordChatSecure | null {
  return requireOptionalNativeModule<NativeAccordChatSecure>('AccordChatSecure');
}
