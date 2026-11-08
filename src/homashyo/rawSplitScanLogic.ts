import { preparationInventoryBarcode } from '../preparation/preparationInventory';
/** First accepted detection or manual entry closes V2 RawMaterialScanDialog. */
export class RawSplitScanGate {
  private completed = false;
  accept(raw: string): string | null {
    if (this.completed) return null;
    const barcode = preparationInventoryBarcode(raw);
    if (!barcode) return null;
    this.completed = true; return barcode;
  }
  reset(): void { this.completed = false; }
}
