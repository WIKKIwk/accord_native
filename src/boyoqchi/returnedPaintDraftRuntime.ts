import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { activeSessionEpoch, activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { boyoqchiDraftAccount, boyoqchiDraftAccountKey, boyoqchiDraftKey } from './boyoqchiDraftScope';
import type { ReturnedPaintImage } from './returnedPaintModel';
import { ReturnedPaintDraftStore, type ReturnedPaintDraftStorage } from './returnedPaintDraft';

// Adapters sharing this module may address the same app-private scope.
const mutations = new Map<string, Promise<void>>();
function serializeMutation(scope: string, action: () => Promise<void>): Promise<void> {
  const prior = mutations.get(scope) ?? Promise.resolve();
  const operation = prior.then(action);
  const settled = operation.then(() => {}, () => {});
  mutations.set(scope, settled);
  void settled.then(() => { if (mutations.get(scope) === settled) mutations.delete(scope); });
  return operation;
}

/** Account/request-scoped files are separate from the worker's existing draft store. */
export class ReturnedPaintDraftFileStorage implements ReturnedPaintDraftStorage {
  constructor(private readonly isCurrent: () => boolean) {}
  private ensureCurrent(): void { if (!this.isCurrent()) throw new Error('Sessiya tugagan. Qayta kiring.'); }
  private root: Directory | null = null;
  private directory(): Directory {
    if (!this.root) {
      const root = new Directory(Paths.document, 'boyoqchi-returned-paint-v1');
      root.create({ intermediates: true, idempotent: true });
      this.root = root;
    }
    return this.root;
  }
  private async file(scope: string): Promise<File> {
    this.ensureCurrent();
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, scope);
    this.ensureCurrent();
    return new File(this.directory(), `${hash}.json`);
  }
  async read(scope: string): Promise<string | null> {
    const file = await this.file(scope), backup = new File(this.directory(), `${file.name}.bak`);
    if (file.exists) {
      try { const value = await file.text(); this.ensureCurrent(); return value; } catch (error) {
        this.ensureCurrent();
        // A concurrent replacement can remove the primary between exists and text.
        if (file.exists || !backup.exists) throw error;
      }
    }
    if (!backup.exists) return null;
    const value = await backup.text(); this.ensureCurrent(); return value;
  }
  write(scope: string, value: string): Promise<void> {
    return serializeMutation(scope, () => this.writeFile(scope, value));
  }
  private async writeFile(scope: string, value: string): Promise<void> {
    const file = await this.file(scope), temporary = new File(this.directory(), `${file.name}.tmp`),
      backup = new File(this.directory(), `${file.name}.bak`);
    // SDK 58 mutates temporary.uri after move; keep a separate reference to the old path.
    const originalTemporary = new File(temporary.uri);
    try {
      this.ensureCurrent();
      temporary.create({ overwrite: true });
      await temporary.write(value);
      this.ensureCurrent();
      // Preserve the last complete primary before SDK overwrite can delete it.
      if (file.exists) { await file.copy(backup, { overwrite: true }); this.ensureCurrent(); }
      await temporary.move(file, { overwrite: true });
      this.ensureCurrent();
    } finally { if (originalTemporary.exists) originalTemporary.delete(); }
  }
  remove(scope: string): Promise<void> {
    return serializeMutation(scope, () => this.removeFile(scope));
  }
  private async removeFile(scope: string): Promise<void> {
    const file = await this.file(scope), backup = new File(this.directory(), `${file.name}.bak`),
      temporary = new File(this.directory(), `${file.name}.tmp`);
    this.ensureCurrent();
    // Remove recovery first, so a completed primary delete cannot resurrect it.
    if (backup.exists) backup.delete();
    if (file.exists) file.delete();
    if (temporary.exists) temporary.delete();
  }
}

export class BoyoqchiSessionDraftStore {
  private readonly account: ReturnType<typeof boyoqchiDraftAccount>;
  private readonly accountKey: string;
  private readonly store: ReturnedPaintDraftStore;
  constructor(private readonly session: Session, private readonly epoch: number, private readonly readScope: string) {
    this.account = boyoqchiDraftAccount(session);
    this.accountKey = boyoqchiDraftAccountKey(this.account);
    this.store = new ReturnedPaintDraftStore(new ReturnedPaintDraftFileStorage(() => this.isCurrent()));
  }
  isCurrent(): boolean {
    try { return !!activeSessionToken(this.session) && activeSessionEpoch(this.session) === this.epoch &&
      sessionReadScope(this.session) === this.readScope && boyoqchiDraftAccountKey(boyoqchiDraftAccount(this.session)) === this.accountKey; }
    catch { return false; }
  }
  private key(requestId: string): string {
    if (!this.isCurrent()) throw new Error('Sessiya tugagan. Qayta kiring.');
    return boyoqchiDraftKey(this.account, requestId);
  }
  async load(requestId: string, image: ReturnedPaintImage | null = null) {
    const draft = await this.store.load(this.key(requestId), image);
    this.key(requestId);
    return draft;
  }
  async clear(requestId: string): Promise<void> { const key = this.key(requestId); await this.store.clear(key); this.key(requestId); }
  flush(requestId: string): Promise<void> { return this.store.flush(this.key(requestId)); }
}
const sessionStores = new WeakMap<Session, { accountKey: string; epoch: number; readScope: string; store: BoyoqchiSessionDraftStore }>();
export function returnedPaintDraftStoreFor(session: Session): BoyoqchiSessionDraftStore {
  const accountKey = boyoqchiDraftAccountKey(boyoqchiDraftAccount(session));
  const epoch = activeSessionEpoch(session), readScope = sessionReadScope(session);
  if (epoch === null || !activeSessionToken(session)) throw new Error('Sessiya tugagan. Qayta kiring.');
  let entry = sessionStores.get(session);
  if (!entry || entry.accountKey !== accountKey || entry.epoch !== epoch || entry.readScope !== readScope) {
    entry = { accountKey, epoch, readScope, store: new BoyoqchiSessionDraftStore(session, epoch, readScope) };
    sessionStores.set(session, entry);
  }
  if (!entry.store.isCurrent()) throw new Error('Sessiya tugagan. Qayta kiring.');
  return entry.store;
}
