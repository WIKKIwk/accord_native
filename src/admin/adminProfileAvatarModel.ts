import { dartTrim } from './dartJsonString';

/** @v2 _canLoadAvatar */
export function adminProfileAvatarCanLoad(value: string): boolean { return /^https?:\/\//i.test(dartTrim(value)); }
/** Source defaults the preview title to the thumbnail's initials. */
export function adminProfileAvatarTitle(displayName: string, fallbackText: string): string { return dartTrim(displayName) || fallbackText; }
/** Source indexes one UTF-16 code unit here, unlike thumbnail initials' grapheme handling. */
export function adminProfileAvatarPreviewInitial(displayName: string): string { return (displayName ? displayName.charAt(0) : 'U').toUpperCase(); }
export function adminProfileAvatarGeometry(width: number, height: number) {
  const previewWidth = Math.min(420, Math.max(260, width - 32));
  return { width: previewWidth, height: Math.min(height * .72, Math.max(280, previewWidth * 1.25)) };
}
export function adminProfileAvatarPadding(size: number): number { return size >= 60 ? 5 : 2; }
