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
    const file = await this.file(scope);
    return file.exists ? file.text() : null;
  }
  async write(scope: string, value: string): Promise<void> {
    const file = await this.file(scope), temporary = new File(this.directory(), `${file.name}.tmp`);
    try {
      temporary.create({ overwrite: true });
      await temporary.write(value);
      temporary.move(file, { overwrite: true });
    } finally { if (temporary.exists) temporary.delete(); }
  }
  async remove(scope: string): Promise<void> {
    const file = await this.file(scope);
    if (file.exists) file.delete();
  }
}

export const returnedPaintDraftStore = new ReturnedPaintDraftStore(new ReturnedPaintDraftFileStorage());
