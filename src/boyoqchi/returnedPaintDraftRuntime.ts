import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
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
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, scope);
    return new File(this.directory(), `${hash}.json`);
  }
  async read(scope: string): Promise<string | null> {
    const file = await this.file(scope), backup = new File(this.directory(), `${file.name}.bak`);
    if (file.exists) {
      try { return await file.text(); } catch (error) {
        // A concurrent replacement can remove the primary between exists and text.
        if (file.exists || !backup.exists) throw error;
      }
    }
    return backup.exists ? backup.text() : null;
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
      temporary.create({ overwrite: true });
      await temporary.write(value);
      // Preserve the last complete primary before SDK overwrite can delete it.
      if (file.exists) await file.copy(backup, { overwrite: true });
      await temporary.move(file, { overwrite: true });
    } finally { if (originalTemporary.exists) originalTemporary.delete(); }
  }
  remove(scope: string): Promise<void> {
    return serializeMutation(scope, () => this.removeFile(scope));
  }
  private async removeFile(scope: string): Promise<void> {
    const file = await this.file(scope), backup = new File(this.directory(), `${file.name}.bak`),
      temporary = new File(this.directory(), `${file.name}.tmp`);
    // Remove recovery first, so a completed primary delete cannot resurrect it.
    if (backup.exists) backup.delete();
    if (file.exists) file.delete();
    if (temporary.exists) temporary.delete();
  }
}

export const returnedPaintDraftStore = new ReturnedPaintDraftStore(new ReturnedPaintDraftFileStorage());
