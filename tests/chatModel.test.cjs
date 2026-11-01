const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/chatModel.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { parseChatConversations, filterChatConversations, chatAvatarSource, chatTime } = loaded.exports;

function row(id, overrides = {}) {
  return {
    conversation_id: id, title: 'Suhbat', peer: { role: 'aparatchi', ref: 'w1', display_name: 'Ali', avatar_url: '' },
    last_message_sequence: 1, unread_count: 2, updated_at_unix: 1700000000,
    last_message: { type: 'text', body: 'Salom', created_at_unix: 1700000100 }, ...overrides,
  };
}

test('list preserves V2 fields and excludes conversations without messages', () => {
  const page = parseChatConversations({ items: [row('1'), row('2', { last_message: null, last_message_sequence: 0 }), row('1')], has_more: true });
  assert.equal(page.hasMore, true);
  assert.equal(page.items.length, 1);
  assert.deepEqual(page.items[0], {
    id: '1', title: 'Ali', peer: { role: 'aparatchi', ref: 'w1', displayName: 'Ali', avatarUrl: '' },
    preview: 'Salom', lastMessageSequence: 1, unreadCount: 2, timestamp: 1700000100,
  });
  assert.throws(() => parseChatConversations({ items: 'invalid' }), /o‘qib bo‘lmadi/);
});

test('special requests and media use the same previews as V2 and search covers names and messages', () => {
  const page = parseChatConversations({ items: [
    row('1', { last_message: { type: 'order_freeze_request', body: 'ignored' } }),
    row('2', { peer: null, title: 'Vali', last_message: { type: 'text', body: '', attachment: { kind: 'audio' } } }),
    row('3', { last_message: { type: 'inventory_transfer_request' } }),
    row('4', { last_message: { type: 'material_link_request' } }),
  ] });
  assert.deepEqual(page.items.map(item => item.preview), ['Buyurtmani muzlatish so‘rovi', 'Ovozli xabar', 'Ombor transferi', 'Homashyo ulash so‘rovi']);
  assert.deepEqual(filterChatConversations(page.items, ' OVOZLI ').map(item => item.id), ['2']);
  assert.deepEqual(filterChatConversations(page.items, 'vali').map(item => item.id), ['2']);
});

test('avatar proxy drops tokens and uses only the active server and peer identity', () => {
  const session = { baseUrl: 'https://erp.example', imageCacheScope: 'session-1' };
  const peer = { role: 'aparatchi', ref: 'worker-1', displayName: 'Ali', avatarUrl: 'https://erp.example/v1/mobile/profile/avatar/view?role=other&ref=other&token=secret&v=photo.jpg' };
  const source = chatAvatarSource(session, peer);
  const uri = new URL(source.uri);
  assert.equal(uri.origin, session.baseUrl);
  assert.equal(uri.searchParams.get('role'), 'aparatchi');
  assert.equal(uri.searchParams.get('ref'), 'worker-1');
  assert.equal(uri.searchParams.get('v'), 'photo.jpg');
  assert.equal(uri.searchParams.has('token'), false);
  assert.equal(source.authenticated, true);
  assert.ok(!source.cacheKey.includes('secret'));
  assert.notEqual(source.cacheKey, chatAvatarSource({ ...session, imageCacheScope: 'session-2' }, peer).cacheKey);
  assert.equal(chatAvatarSource({ ...session, baseUrl: 'http://erp.example' }, peer), null);
  assert.equal(chatAvatarSource(session, { ...peer, avatarUrl: 'https://evil.example/image?token=secret' }), null);
  assert.equal(chatAvatarSource(session, { ...peer, avatarUrl: 'https://cdn.example/image.jpg' }).authenticated, false);
});

test('timestamps display a time today and a separate yesterday label', () => {
  const now = new Date(2026, 10, 1, 12, 0);
  const today = new Date(2026, 10, 1, 8, 0).getTime() / 1000;
  const yesterday = new Date(2026, 9, 31, 23, 0).getTime() / 1000;
  assert.ok(chatTime(today, now));
  assert.equal(chatTime(yesterday, now), 'Kecha');
  assert.equal(chatTime(0, now), '');
});
