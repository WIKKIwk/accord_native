import type { PendingChatReceipt } from './chatLocalStore';

type ReceiptFlusherDependencies = {
  isCurrent: () => boolean;
  deviceId: () => Promise<string>;
  load: () => Promise<readonly PendingChatReceipt[]>;
  delivered: (conversationId: string, sequence: number, deviceId: string) => Promise<void>;
  read: (conversationId: string, sequence: number, deviceId: string) => Promise<void>;
  acknowledge: (conversationId: string, deliveredSequence: number, readSequence: number) => Promise<void>;
};

/** Source: V2 ChatStore._flushPendingReceipts. */
export class ChatReceiptFlusher {
  private running: Promise<void> | null = null;
  private requested = false;

  constructor(private readonly deps: ReceiptFlusherDependencies) {}

  /** A receipt queued while a flush is running requires one more pass. */
  receiptQueued(): void {
    if (this.running) this.requested = true;
  }

  flush(): Promise<void> {
    if (!this.deps.isCurrent()) return Promise.resolve();
    if (this.running) { this.requested = true; return this.running; }
    let operation!: Promise<void>;
    operation = this.run().then(async () => {
      if (this.running === operation) this.running = null;
      // A receipt can arrive after the last loop condition but before this
      // promise settles. Do not lose that request in the handoff.
      if (this.requested && this.deps.isCurrent()) await this.flush();
    }, error => {
      if (this.running === operation) this.running = null;
      throw error;
    });
    this.running = operation;
    return operation;
  }

  private async run(): Promise<void> {
    do {
      this.requested = false;
      const deviceId = await this.deps.deviceId();
      if (!this.deps.isCurrent()) return;
      const receipts = await this.deps.load();
      for (const receipt of receipts) {
        if (!this.deps.isCurrent()) return;
        let deliveredAcknowledged = 0;
        if (receipt.deliveredSequence > 0) {
          try {
            await this.deps.delivered(receipt.conversationId, receipt.deliveredSequence, deviceId);
            if (!this.deps.isCurrent()) return;
            deliveredAcknowledged = receipt.deliveredSequence;
          } catch { continue; }
        }
        let readAcknowledged = 0;
        if (receipt.readSequence > 0) {
          try {
            await this.deps.read(receipt.conversationId, receipt.readSequence, deviceId);
            if (!this.deps.isCurrent()) return;
            readAcknowledged = receipt.readSequence;
          } catch {
            if (!this.deps.isCurrent()) return;
            await this.deps.acknowledge(receipt.conversationId, deliveredAcknowledged, 0);
            continue;
          }
        }
        if (!this.deps.isCurrent()) return;
        await this.deps.acknowledge(receipt.conversationId, deliveredAcknowledged, readAcknowledged);
      }
    } while (this.requested && this.deps.isCurrent());
  }
}
