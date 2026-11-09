import { newQolipReworkRequestId } from './qolipReworkRequestId';

type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type QolipStorageIntentBody = Readonly<Record<string, JsonValue>>;

/** @v2 QolipStorageIntent */
export class QolipStorageIntent {
  private retained: { signature: string; id: Promise<string> } | null = null;
  constructor(private readonly nextRequestId: () => Promise<string> = newQolipReworkRequestId) {}

  keyFor(intent: QolipStorageIntentBody): Promise<string> {
    // Preserve insertion order and array order: V2 compares jsonEncode, not a sorted hash.
    const signature = JSON.stringify(intent);
    if (this.retained?.signature === signature) return this.retained.id;
    const retained = { signature, id: Promise.resolve().then(() => this.nextRequestId()) };
    this.retained = retained;
    retained.id = retained.id.catch(error => {
      if (this.retained === retained) this.retained = null;
      throw error;
    });
    return retained.id;
  }

  complete(): void { this.retained = null; }
}
