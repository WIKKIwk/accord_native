import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class AccordNativeClock extends NativeModule {
  microsecondsSinceEpoch(): string;
}

/** No millisecond or insecure fallback; an older development binary must be rebuilt. */
export function nativeEpochMicroseconds(): string {
  const clock = requireOptionalNativeModule<AccordNativeClock>('AccordNativeClock');
  if (!clock) throw new Error('accord_clock_unavailable');
  const value = clock.microsecondsSinceEpoch();
  if (typeof value !== 'string' || value.trim() !== value || !/^-?\d+$/.test(value)) throw new Error('accord_clock_invalid');
  return value;
}
