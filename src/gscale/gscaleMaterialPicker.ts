import type { SupplierItem } from '../shared/catalogApi';
import { materialReceiptChoices } from './gscaleCatalog';

type Choice = { item: SupplierItem; micron: number | null };
type ItemLoader = (query: string, offset: number, limit: number, orderId: string) => Promise<SupplierItem[]>;

/** Catalog paging and per-order choice caching from _openItemPicker. */
export class GScaleMaterialPicker {
  private orderId = '';
  private cached: Promise<Choice[]> | null = null;
  constructor(private readonly load: ItemLoader) {}

  /** @v2 _loadMaterialOrderChoices */
  async orderChoices(orderId: string): Promise<Choice[]> {
    if (this.orderId !== orderId || !this.cached) {
      this.orderId = orderId;
      this.cached = this.load('', 0, 200, orderId).then(materialReceiptChoices);
    }
    const future = this.cached;
    try { return await future; }
    catch (error) {
      if (this.cached === future) { this.cached = null; this.orderId = ''; }
      throw error;
    }
  }

  async page(query: string, offset: number, limit: number, linkedOrderId: string, isMaterialReceipt: boolean): Promise<Choice[]> {
    const order = linkedOrderId.trim();
    if (isMaterialReceipt && order) {
      const needle = query.trim().toLowerCase();
      return (await this.orderChoices(order)).filter(choice =>
        `${choice.item.name} ${choice.item.code} ${choice.micron ?? ''}`.toLowerCase().includes(needle)).slice(offset, offset + limit);
    }
    if (!order || isMaterialReceipt) {
      return (await this.load(query, offset, limit, order)).map(item => ({ item, micron: null }));
    }
    return (await this.load(query, 0, 200, order)).filter(item => Object.keys(item.order_apparatus_options).length > 0)
      .slice(offset, offset + limit).map(item => ({ item, micron: item.order_microns.length === 1 ? item.order_microns[0] : null }));
  }

  /** @v2 _prefillSingleMaterialOrderChoice */
  async singleOrderChoice(orderId: string): Promise<Choice | null> {
    const choices = await this.orderChoices(orderId);
    if (!choices.length || new Set(choices.map(choice => choice.item.code.trim().toLowerCase())).size !== 1) return null;
    const micronValues = new Set(choices.map(choice => choice.micron));
    return { item: choices[0].item, micron: micronValues.size === 1 ? choices[0].micron : null };
  }

  clear(): void { this.orderId = ''; this.cached = null; }
}
