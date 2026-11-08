import * as SQLite from 'expo-sqlite';
import type { Session } from '../../auth';
import type { ChatConversation, ChatMessage } from '../../chatModel';

type ConversationRow = { payload_json: string };
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
  await inDatabaseOrder(async () => {
    const db = await openDatabase();
    await db.withExclusiveTransactionAsync(async transaction => {
      for (const item of items) {
        await transaction.runAsync(`INSERT OR REPLACE INTO chat_conversations
          (account_scope, conversation_id, updated_at_unix, payload_json) VALUES (?, ?, ?, ?)`,
        scope, item.id, item.updatedAt, JSON.stringify(item));
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
  await inDatabaseOrder(async () => {
    const db = await openDatabase();
    await db.withExclusiveTransactionAsync(async transaction => {
      for (const item of items) {
        await transaction.runAsync(`INSERT OR REPLACE INTO chat_messages
          (account_scope, conversation_id, message_sequence, message_id, payload_json) VALUES (?, ?, ?, ?, ?)`,
        scope, item.conversationId, item.sequence, item.id, JSON.stringify(item));
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
