import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ReturnedPaintDraftStore, type ReturnedPaintDraftStorage } from './returnedPaintDraft';

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
  async write(scope: string, value: string): Promise<void> {
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
  async remove(scope: string): Promise<void> {
    const file = await this.file(scope), backup = new File(this.directory(), `${file.name}.bak`),
      temporary = new File(this.directory(), `${file.name}.tmp`);
    // Remove recovery first, so a completed primary delete cannot resurrect it.
    if (backup.exists) backup.delete();
    if (file.exists) file.delete();
    if (temporary.exists) temporary.delete();
  }
}

export const returnedPaintDraftStore = new ReturnedPaintDraftStore(new ReturnedPaintDraftFileStorage());
