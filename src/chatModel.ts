import type { Session } from './auth';
import type { PendingChatText } from './chatOutbox';

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
export type ChatMessage = {
  id: string;
  conversationId: string;
  clientMessageId: string;
  sequence: number;
  senderRole: string;
  senderRef: string;
  body: string;
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

export function parseChatMessage(value: unknown, conversationId: string): ChatMessage | null {
  const row = object(value);
  const id = text(row.message_id);
  const sequence = integer(row.sequence);
  if (!id || !sequence || text(row.conversation_id) !== conversationId) return null;
  const type = text(row.type);
  const deleted = integer(row.deleted_at_unix) > 0;
  const attachment = text(object(row.attachment).kind);
  const attachmentLabel = attachment === 'image' ? 'Rasm' : attachment === 'video' ? 'Video' : attachment === 'audio' ? 'Ovozli xabar' : '';
  const caption = text(row.body);
  return {
    id, conversationId, sequence,
    clientMessageId: text(row.client_message_id), senderRole: text(row.sender_role), senderRef: text(row.sender_ref),
    body: deleted ? 'Xabar o‘chirilgan' : attachmentLabel ? [attachmentLabel, caption].filter(Boolean).join('\n') : type === 'text' ? caption : messagePreview(row),
    timestamp: integer(row.created_at_unix),
  };
}

export function parseChatMessages(value: unknown, conversationId: string): { items: ChatMessage[]; hasMore: boolean } {
  const page = object(value);
  if (!Array.isArray(page.items)) throw new Error('Xabarlarni o‘qib bo‘lmadi.');
  const messages = page.items.map(item => parseChatMessage(item, conversationId)).filter((item): item is ChatMessage => item !== null);
  return { items: mergeChatMessages([], messages), hasMore: page.has_more === true };
}

export function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map(message => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}

/** Keep the latest continuous history when a long disconnection leaves a gap. */
export function reconcileChatRefresh(current: ChatMessage[], incoming: ChatMessage[]) {
  const merged = mergeChatMessages(current, incoming);
  let start = 0;
  for (let index = 1; index < merged.length; index++) {
    if (merged[index].sequence > merged[index - 1].sequence + 1) start = index;
  }
  return { items: merged.slice(start), droppedOlder: start > 0 };
}

export function isMyChatMessage(session: Session, message: ChatMessage): boolean {
  return message.senderRole === text(session.profile.role) && message.senderRef === text(session.profile.ref);
}

export function outgoingMessageKey(clientMessageId: string): string {
  return `outgoing:${clientMessageId}`;
}

/** Keep the same row identity when an outgoing message is confirmed by the server. */
export function chatTimeline(session: Session, messages: ChatMessage[], pending: PendingChatText[]) {
  const mine = messages.filter(message => isMyChatMessage(session, message));
  const confirmedIds = new Set(mine.map(message => message.clientMessageId));
  return [
    ...messages.map(message => {
      const isMine = isMyChatMessage(session, message);
      return { key: isMine && message.clientMessageId ? outgoingMessageKey(message.clientMessageId) : `message:${message.id}`,
        body: message.body, timestamp: message.timestamp, mine: isMine, pending: false };
    }),
    ...pending.filter(item => !confirmedIds.has(item.clientMessageId)).map(item => ({
      key: outgoingMessageKey(item.clientMessageId), body: item.body, timestamp: item.createdAt, mine: true, pending: true,
    })),
  ];
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
