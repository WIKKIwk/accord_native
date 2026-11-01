import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { activeSessionToken, type Session } from './auth';

export type PendingChatText = { conversationId: string; clientMessageId: string; body: string; createdAt: number };
type PendingRow = { conversation_id: string; client_message_id: string; body: string; created_at: number };
let database: Promise<SQLite.SQLiteDatabase> | undefined;

function accountScope(session: Session): string {
  const role = typeof session.profile.role === 'string' ? session.profile.role.trim() : '';
  const ref = typeof session.profile.ref === 'string' ? session.profile.ref.trim() : '';
  const server = new URL(session.baseUrl);
  if (server.protocol !== 'https:' || server.origin !== session.baseUrl || !role || !ref) throw new Error('Sessiya noto‘g‘ri.');
  return JSON.stringify([server.origin, role, ref]);
}

function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!database) {
    const pending = SQLite.openDatabaseAsync('accord-chat.db').then(async db => {
      await db.execAsync(`CREATE TABLE IF NOT EXISTS chat_outbox (
        account_scope TEXT NOT NULL, conversation_id TEXT NOT NULL, client_message_id TEXT NOT NULL,
        body TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (account_scope, client_message_id)
      ); CREATE INDEX IF NOT EXISTS chat_outbox_conversation ON chat_outbox (account_scope, conversation_id, created_at);
      CREATE TABLE IF NOT EXISTS chat_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`);
      return db;
    });
    database = pending.catch(error => { database = undefined; throw error; });
  }
  return database;
}

export async function queueChatText(session: Session, conversationId: string, body: string): Promise<PendingChatText> {
  const scope = accountScope(session);
  const id = conversationId.trim();
  const text = body.trim();
  if (!activeSessionToken(session) || !id || id === '.' || id === '..' || !text || Array.from(text).length > 4000) throw new Error('Xabar matni noto‘g‘ri.');
  const item = { conversationId: id, clientMessageId: `client_${Crypto.randomUUID()}`, body: text, createdAt: Math.floor(Date.now() / 1000) };
  const db = await openDatabase();
  if (!activeSessionToken(session)) throw new Error('Sessiya tugagan.');
  await db.runAsync('INSERT INTO chat_outbox (account_scope, conversation_id, client_message_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
    scope, item.conversationId, item.clientMessageId, item.body, item.createdAt);
  return item;
}

export async function pendingChatTexts(session: Session, conversationId: string): Promise<PendingChatText[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<PendingRow>(
    'SELECT conversation_id, client_message_id, body, created_at FROM chat_outbox WHERE account_scope = ? AND conversation_id = ? ORDER BY created_at, rowid',
    accountScope(session), conversationId,
  );
  return rows.map(row => ({ conversationId: row.conversation_id, clientMessageId: row.client_message_id, body: row.body, createdAt: row.created_at }));
}

export async function removePendingChatText(session: Session, clientMessageId: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM chat_outbox WHERE account_scope = ? AND client_message_id = ?', accountScope(session), clientMessageId);
}

export async function chatDeviceId(): Promise<string> {
  const db = await openDatabase();
  await db.runAsync('INSERT OR IGNORE INTO chat_metadata (key, value) VALUES (?, ?)', 'device_id', `device_${Crypto.randomUUID()}`);
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM chat_metadata WHERE key = ?', 'device_id');
  if (!row?.value) throw new Error('Qurilma ma’lumoti olinmadi.');
  return row.value;
}
