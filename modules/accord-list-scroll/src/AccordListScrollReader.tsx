import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType, ReactNode } from 'react';

export type AccordListScrollReaderProps = { targetID: string; children: ReactNode };

const native = requireOptionalNativeModule<{ supportsListScroll: boolean }>('AccordListScroll');
const NativeReader: ComponentType<AccordListScrollReaderProps> | null = native?.supportsListScroll
  ? requireNativeView<AccordListScrollReaderProps>('AccordListScroll', 'AccordListScrollReaderView') : null;

/** Existing Expo Go/development binaries keep their working manual List scrolling. */
export function AccordListScrollReader(props: AccordListScrollReaderProps) {
  return NativeReader ? <NativeReader {...props} /> : <>{props.children}</>;
}
