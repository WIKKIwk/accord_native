import type { SFSymbol } from 'sf-symbols-typescript';

export type AdminTopNoticeTone = 'success' | 'error';
/** Original bundled native icons, never a network resource or a mutable renderer. */
export type AdminTopNoticeIcon = Readonly<{ androidSource: number; iosSystemName: SFSymbol }>;
export type AdminTopNoticeMessage = Readonly<{ message: string; tone: AdminTopNoticeTone; icon?: AdminTopNoticeIcon }>;
export type AdminTopNoticeBanner = AdminTopNoticeMessage & Readonly<{
  identity: object; attachText: (identity: object) => (() => void); abandon: () => void;
}>;
export type AdminTopNoticeScaffold = Readonly<{ readonly __adminTopNoticeScaffold: unique symbol }>;
export type AdminTopNoticeTransition = Readonly<{ identity: object; banner: AdminTopNoticeBanner; target: 0 | 1; reset: boolean }>;
export const adminTopNoticeDuration = 5000, adminTopNoticeTransitionDuration = 250;
export const adminTopNoticeHeightCurve = Object.freeze([.4, 0, .2, 1] as const);
/** @v2 _adminNoticeBanner */
export const adminTopNoticeColors = (tone: AdminTopNoticeTone) => tone === 'success'
  ? { background: '#E6F4EA', foreground: '#173A24' } : { background: '#FCE8E6', foreground: '#5F1412' };
export function captureAdminTopNoticeMessage(value: AdminTopNoticeMessage): AdminTopNoticeMessage | null {
  try {
    if (!value) return null; const { message, tone, icon } = value;
    if (typeof message !== 'string' || !['success', 'error'].includes(tone)) return null;
    if (icon !== undefined && (!icon || !Number.isInteger(icon.androidSource) || icon.androidSource <= 0 || typeof icon.iosSystemName !== 'string' || !icon.iosSystemName)) return null;
    return Object.freeze({ message, tone, ...(icon ? { icon: Object.freeze({ androidSource: icon.androidSource, iosSystemName: icon.iosSystemName }) } : {}) });
  } catch { return null; }
}
