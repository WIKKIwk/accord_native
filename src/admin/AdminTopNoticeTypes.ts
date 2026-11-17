import type { AdminTopNoticeBanner } from './adminTopNoticeModel';
import type { AdminTopNoticeScaffoldBinding } from './useAdminTopNoticeScaffold';

/** Real remaining Source banner SafeArea after Scaffold has removed top/bottom padding for its native AppBar. */
export type AdminTopNoticeInlineInsets = Readonly<{ left: number; right: number; width?: number }>;
export type AdminTopNoticeHostProps = Readonly<{ scaffold: AdminTopNoticeScaffoldBinding; inlineInsets: AdminTopNoticeInlineInsets | null; dismissLabel: string }>;
export type AdminTopNoticeContentProps = Readonly<{ banner: AdminTopNoticeBanner }>;
