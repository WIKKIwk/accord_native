import type { Session } from './auth';

export type ChatPeer = { role: string; ref: string; displayName: string; avatarUrl: string };
export type ChatConversation = {
  id: string;
  title: string;
  peer: ChatPeer | null;
  preview: string;
  lastMessageSequence: number;
  unreadCount: number;
  timestamp: number;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function integer(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function messagePreview(value: Record<string, unknown>): string {
  switch (text(value.type)) {
    case 'material_link_request': return 'Homashyo ulash so‘rovi';
    case 'order_freeze_request': return 'Buyurtmani muzlatish so‘rovi';
    case 'inventory_transfer_request': return 'Ombor transferi';
  }
  const body = text(value.body);
  if (body) return body;
  switch (text(object(value.attachment).kind)) {
    case 'image': return 'Rasm';
    case 'video': return 'Video';
    case 'audio': return 'Ovozli xabar';
    default: return 'Xabar';
  }
}

/** Match V2: only conversations containing a message appear in the list. */
export function parseChatConversations(value: unknown): { items: ChatConversation[]; hasMore: boolean } {
  const page = object(value);
  if (!Array.isArray(page.items)) throw new Error('Chat ma’lumotlarini o‘qib bo‘lmadi.');
  const items: ChatConversation[] = [];
  const seen = new Set<string>();
  for (const raw of page.items) {
    const row = object(raw);
    const id = text(row.conversation_id);
    const sequence = integer(row.last_message_sequence);
    const message = object(row.last_message);
    if (!id || seen.has(id) || !sequence || !Object.keys(message).length) continue;
    seen.add(id);
    const rawPeer = object(row.peer);
    const peer = Object.keys(rawPeer).length ? {
      role: text(rawPeer.role), ref: text(rawPeer.ref),
      displayName: text(rawPeer.display_name), avatarUrl: text(rawPeer.avatar_url),
    } : null;
    items.push({
      id, peer, title: peer?.displayName || text(row.title) || 'Suhbat',
      preview: messagePreview(message), lastMessageSequence: sequence,
      unreadCount: integer(row.unread_count),
      timestamp: integer(message.created_at_unix) || integer(row.updated_at_unix),
    });
  }
  return { items, hasMore: page.has_more === true };
}

export function filterChatConversations(items: ChatConversation[], query: string): ChatConversation[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return items;
  return items.filter(item => item.title.toLocaleLowerCase().includes(needle) || item.preview.toLocaleLowerCase().includes(needle));
}

/** Never forward the session token to an arbitrary avatar URL or put it in a cache key. */
export function chatAvatarSource(session: Session, peer: ChatPeer | null) {
  if (!peer?.avatarUrl || !peer.role || !peer.ref) return null;
  try {
    const base = new URL(session.baseUrl);
    if (base.protocol !== 'https:' || base.origin !== session.baseUrl) return null;
    const raw = new URL(peer.avatarUrl, base.origin);
    if (raw.origin === base.origin && raw.pathname === '/v1/mobile/profile/avatar/view') {
      const uri = new URL('/v1/mobile/profile/avatar/view', base.origin);
      uri.searchParams.set('role', peer.role);
      uri.searchParams.set('ref', peer.ref);
      const version = raw.searchParams.get('v') ?? '';
      if (version) uri.searchParams.set('v', version);
      return { uri: uri.toString(), cacheKey: JSON.stringify(['chat-avatar', session.imageCacheScope, base.origin, peer.role, peer.ref, version]), authenticated: true };
    }
    if (raw.protocol !== 'https:' || raw.username || raw.password || [...raw.searchParams.keys()].some(key => /token|auth|signature/i.test(key))) return null;
    return { uri: raw.toString(), cacheKey: JSON.stringify(['chat-avatar-public', session.imageCacheScope, peer.role, peer.ref, raw.origin, raw.pathname]), authenticated: false };
  } catch { return null; }
}

export function chatTime(timestamp: number, now = new Date()): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return '';
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Kecha';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}
