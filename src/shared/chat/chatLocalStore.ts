import * as SQLite from 'expo-sqlite';
import type { Session } from '../../auth';
import type { ChatConversation, ChatMessage } from '../../chatModel';

type ConversationRow = { payload_json: string };
type ReceiptRow = { conversation_id: string; delivered_sequence: number; read_sequence: number };
export type PendingChatReceipt = { conversationId: string; deliveredSequence: number; readSequence: number };
let database: Promise<SQLite.SQLiteDatabase> | undefined;
let operationQueue: Promise<void> = Promise.resolve();

// Expo's exclusive transaction uses a second connection. Serialize our own
// reads and writes so concurrent sync, receipt and refresh work cannot collide.
function inDatabaseOrder<T>(action: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(action);
  operationQueue = result.then(() => undefined, () => undefined);
  return result;
}

/** Uses the same account/server isolation as the existing Chat outbox. */
export function chatCacheScope(session: Session): string {
  const role = typeof session.profile.role === 'string' ? session.profile.role.trim() : '';
  const ref = typeof session.profile.ref === 'string' ? session.profile.ref.trim() : '';
  const server = new URL(session.baseUrl);
  if (server.protocol !== 'https:' || server.origin !== session.baseUrl || !role || !ref) throw new Error('Sessiya noto‘g‘ri.');
  return JSON.stringify([server.origin, role, ref]);
}

function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!database) {
    const pending = SQLite.openDatabaseAsync('accord-chat-state.db').then(async db => {
      await db.execAsync(`CREATE TABLE IF NOT EXISTS chat_conversations (
        account_scope TEXT NOT NULL, conversation_id TEXT NOT NULL,
        updated_at_unix INTEGER NOT NULL, payload_json TEXT NOT NULL,
        PRIMARY KEY (account_scope, conversation_id)
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        account_scope TEXT NOT NULL, conversation_id TEXT NOT NULL,
        message_sequence INTEGER NOT NULL, message_id TEXT NOT NULL, payload_json TEXT NOT NULL,
        PRIMARY KEY (account_scope, conversation_id, message_sequence),
        UNIQUE (account_scope, message_id)
      );
      CREATE TABLE IF NOT EXISTS chat_sync_state (
        account_scope TEXT PRIMARY KEY NOT NULL, event_cursor INTEGER NOT NULL DEFAULT 0,
        updated_at_unix INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat_pending_receipts (
        account_scope TEXT NOT NULL, conversation_id TEXT NOT NULL,
        delivered_sequence INTEGER NOT NULL DEFAULT 0, read_sequence INTEGER NOT NULL DEFAULT 0,
        updated_at_unix INTEGER NOT NULL, PRIMARY KEY (account_scope, conversation_id)
      );`);
      return db;
    });
    database = pending.catch(error => { database = undefined; throw error; });
  }
  return database;
}

/** @v2 ChatLocalStore.loadConversations */
export async function loadCachedChatConversations(session: Session): Promise<ChatConversation[]> {
  const scope = chatCacheScope(session);
  return inDatabaseOrder(async () => {
    const db = await openDatabase();
    const rows = await db.getAllAsync<ConversationRow>(
      'SELECT payload_json FROM chat_conversations WHERE account_scope = ? ORDER BY updated_at_unix DESC LIMIT 100', scope,
    );
    return rows.map(row => JSON.parse(row.payload_json) as ChatConversation);
  });
}

/** @v2 ChatLocalStore.saveConversations */
export async function saveCachedChatConversations(session: Session, items: readonly ChatConversation[]): Promise<void> {
  const scope = chatCacheScope(session);
  const rows = items.map(item => ({ id: item.id, updatedAt: item.updatedAt, payload: JSON.stringify(item) }));
  await inDatabaseOrder(async () => {
    const db = await openDatabase();
    await db.withExclusiveTransactionAsync(async transaction => {
      for (const row of rows) {
        await transaction.runAsync(`INSERT OR REPLACE INTO chat_conversations
          (account_scope, conversation_id, updated_at_unix, payload_json) VALUES (?, ?, ?, ?)`,
        scope, row.id, row.updatedAt, row.payload);
      }
    });
  });
}

/** @v2 ChatLocalStore.loadMessages */
export async function loadCachedChatMessages(session: Session, conversationId: string): Promise<ChatMessage[]> {
  const scope = chatCacheScope(session);
  return inDatabaseOrder(async () => {
    const db = await openDatabase();
    const rows = await db.getAllAsync<ConversationRow>(`SELECT payload_json FROM chat_messages
      WHERE account_scope = ? AND conversation_id = ? ORDER BY message_sequence DESC LIMIT 100`, scope, conversationId);
    return rows.reverse().map(row => JSON.parse(row.payload_json) as ChatMessage);
  });
}

/** @v2 ChatLocalStore.saveMessages */
export async function saveCachedChatMessages(session: Session, items: readonly ChatMessage[]): Promise<void> {
  const scope = chatCacheScope(session);
  const rows = items.map(item => ({ id: item.id, conversationId: item.conversationId, sequence: item.sequence, payload: JSON.stringify(item) }));
  await inDatabaseOrder(async () => {
    const db = await openDatabase();
    await db.withExclusiveTransactionAsync(async transaction => {
      for (const row of rows) {
        await transaction.runAsync(`INSERT OR REPLACE INTO chat_messages
          (account_scope, conversation_id, message_sequence, message_id, payload_json) VALUES (?, ?, ?, ?, ?)`,
        scope, row.conversationId, row.sequence, row.id, row.payload);
      }
    });
  });
}

/** @v2 ChatLocalStore.latestMessageSequence */
export async function latestCachedChatMessageSequence(session: Session, conversationId: string): Promise<number> {
  const scope = chatCacheScope(session);
  return inDatabaseOrder(async () => {
    const db = await openDatabase();
    const row = await db.getFirstAsync<{ latest_sequence: number }>(`SELECT COALESCE(MAX(message_sequence), 0) AS latest_sequence
      FROM chat_messages WHERE account_scope = ? AND conversation_id = ?`, scope, conversationId);
    return row?.latest_sequence ?? 0;
  });
}

/** @v2 ChatLocalStore.loadSyncCursor */
export async function loadCachedChatSyncCursor(session: Session): Promise<number> {
  const scope = chatCacheScope(session);
  return inDatabaseOrder(async () => {
    const db = await openDatabase();
    const row = await db.getFirstAsync<{ event_cursor: number }>(
      'SELECT event_cursor FROM chat_sync_state WHERE account_scope = ? LIMIT 1', scope,
    );
    return row?.event_cursor ?? 0;
  });
}

/** @v2 ChatLocalStore.saveSyncCursor */
export async function saveCachedChatSyncCursor(session: Session, cursor: number): Promise<void> {
  const scope = chatCacheScope(session);
  await inDatabaseOrder(async () => {
    const db = await openDatabase();
    await db.runAsync('INSERT OR REPLACE INTO chat_sync_state (account_scope, event_cursor, updated_at_unix) VALUES (?, ?, ?)',
      scope, cursor, Math.floor(Date.now() / 1000));
  });
}

/** @v2 ChatLocalStore.loadPendingReceipts */
export async function loadPendingChatReceipts(session: Session): Promise<PendingChatReceipt[]> {
  const scope = chatCacheScope(session);
  return inDatabaseOrder(async () => {
    const db = await openDatabase();
    const rows = await db.getAllAsync<ReceiptRow>(`SELECT conversation_id, delivered_sequence, read_sequence
      FROM chat_pending_receipts WHERE account_scope = ? ORDER BY updated_at_unix ASC`, scope);
    return rows.map(row => ({ conversationId: row.conversation_id, deliveredSequence: row.delivered_sequence, readSequence: row.read_sequence }));
  });
}

/** @v2 ChatLocalStore.savePendingReceipt */
export async function savePendingChatReceipt(session: Session, receipt: PendingChatReceipt): Promise<void> {
  const scope = chatCacheScope(session);
  const { conversationId, deliveredSequence, readSequence } = receipt;
  await inDatabaseOrder(async () => {
    const db = await openDatabase();
    await db.runAsync(`INSERT INTO chat_pending_receipts
      (account_scope, conversation_id, delivered_sequence, read_sequence, updated_at_unix) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_scope, conversation_id) DO UPDATE SET
        delivered_sequence = MAX(delivered_sequence, excluded.delivered_sequence),
        read_sequence = MAX(read_sequence, excluded.read_sequence), updated_at_unix = excluded.updated_at_unix`,
    scope, conversationId, deliveredSequence, readSequence, Math.floor(Date.now() / 1000));
  });
}

/** @v2 ChatLocalStore.removePendingReceipt */
export async function removePendingChatReceipt(session: Session, conversationId: string): Promise<void> {
  const scope = chatCacheScope(session);
  await inDatabaseOrder(async () => {
    const db = await openDatabase();
    await db.runAsync('DELETE FROM chat_pending_receipts WHERE account_scope = ? AND conversation_id = ?', scope, conversationId);
  });
}

/** @v2 ChatLocalStore.acknowledgePendingReceipt */
export async function acknowledgePendingChatReceipt(
  session: Session, conversationId: string, deliveredSequence = 0, readSequence = 0,
): Promise<void> {
  const scope = chatCacheScope(session);
  await inDatabaseOrder(async () => {
    const db = await openDatabase();
    await db.withExclusiveTransactionAsync(async transaction => {
      await transaction.runAsync(`UPDATE chat_pending_receipts SET
        delivered_sequence = CASE WHEN delivered_sequence <= ? THEN 0 ELSE delivered_sequence END,
        read_sequence = CASE WHEN read_sequence <= ? THEN 0 ELSE read_sequence END
        WHERE account_scope = ? AND conversation_id = ?`, deliveredSequence, readSequence, scope, conversationId);
      await transaction.runAsync(`DELETE FROM chat_pending_receipts WHERE account_scope = ? AND conversation_id = ?
        AND delivered_sequence = 0 AND read_sequence = 0`, scope, conversationId);
    });
  });
}
