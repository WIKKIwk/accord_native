import type { OutlinedTextFieldProps } from '@expo/ui/jetpack-compose';
import type { AdminProgressQrLookupController, AdminProgressQrManualTicket } from './adminProgressQrLookupController';

/** One actual useNativeState('') owned by the original PAGE, not recreated for each dialog. Both platforms share this Expo observable type. */
export type AdminProgressQrManualBuffer = NonNullable<OutlinedTextFieldProps['value']>;
/** Accepted raw result only. This is never evidence of native removal. */
export type AdminProgressQrManualClose = Readonly<{ rawValue: string | null }>;
export type AdminProgressQrManualHost = Readonly<{
  surfaceIdentity: object; controller: AdminProgressQrLookupController; ticket: AdminProgressQrManualTicket;
  buffer: AdminProgressQrManualBuffer;
  /** Original account, page and this exact native window, independent of body mount and accepted closing. */
  isCurrent: () => boolean;
  /** Actual own native dialog interaction authority. */
  canInteract: () => boolean;
  /** Hide this original dialog; after genuine removal only, call completeManualRaw(original ticket, rawValue). */
  onCloseRequested: (close: AdminProgressQrManualClose) => void;
}>;
export type AdminProgressQrManualContentProps = AdminProgressQrManualHost & Readonly<{ p: (key: string) => string }>;
