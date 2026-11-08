import * as SQLite from 'expo-sqlite';
import type { Session } from '../../auth';
import type { ChatConversation } from '../../chatModel';

type ConversationRow = { payload_json: string };
let database: Promise<SQLite.SQLiteDatabase> | undefined;

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
  const db = await openDatabase();
  const rows = await db.getAllAsync<ConversationRow>(
    'SELECT payload_json FROM chat_conversations WHERE account_scope = ? ORDER BY updated_at_unix DESC LIMIT 100', scope,
  );
  return rows.map(row => JSON.parse(row.payload_json) as ChatConversation);
}

/** @v2 ChatLocalStore.saveConversations */
export async function saveCachedChatConversations(session: Session, items: readonly ChatConversation[]): Promise<void> {
  const scope = chatCacheScope(session);
  const db = await openDatabase();
  await db.withExclusiveTransactionAsync(async transaction => {
    for (const item of items) {
      await transaction.runAsync(`INSERT OR REPLACE INTO chat_conversations
        (account_scope, conversation_id, updated_at_unix, payload_json) VALUES (?, ?, ?, ?)`,
      scope, item.id, item.updatedAt, JSON.stringify(item));
    }
  });
}
