import type { qolipProductFromJson } from '../qolipCatalogApi';
import { trimDart } from './qolipApiCommon';
import type { QolipBlock } from './qolipBlocksApi';
import type { QolipLocationEntry } from './qolipLocationsApi';
import { filterQolipSearch, QolipSearchDocument } from './qolipSearchEngine';

export type QolipPlacementProduct = ReturnType<typeof qolipProductFromJson>;
const normalizedCode = (code: string) => trimDart(code).toLowerCase();

/** @v2 qolipProductsAvailableForCellPlacement */
export function qolipProductsAvailableForCellPlacement(products: readonly QolipPlacementProduct[],
  placedCodes: ReadonlySet<string>): QolipPlacementProduct[] {
  const placed = new Set([...placedCodes].map(normalizedCode).filter(Boolean));
  const seen = new Set<string>();
  return products.filter(product => {
    const code = normalizedCode(product.qolip_code);
    if (!product.has_qolip_spec || !code || product.size <= 0 || product.is_in_use || seen.has(code)) return false;
    seen.add(code);
    return !placed.has(code);
  });
}

/** @v2 _loadPlacedQolipCodes */
export async function qolipPlacedCodes(blocks: readonly QolipBlock[],
  locations: (block: string) => Promise<readonly QolipLocationEntry[]>): Promise<Set<string>> {
  const names = new Set(blocks.map(block => trimDart(block.name)).filter(Boolean));
  const results = await Promise.all([...names].map(locations));
  const codes = new Set<string>();
  for (const rows of results) for (const row of rows) {
    if (trimDart(row.row_letter) && row.column_number !== null) {
      const code = normalizedCode(row.qolip_code);
      if (code) codes.add(code);
    }
  }
  return codes;
}

const productDocuments = new WeakMap<QolipPlacementProduct, QolipSearchDocument>();
/** @v2 qolipProductSearchDocument */
export function qolipPlacementProductSearchDocument(product: QolipPlacementProduct): QolipSearchDocument {
  let document = productDocuments.get(product);
  if (!document) {
    document = new QolipSearchDocument([product.name, product.code, product.item_group, product.qolip_code,
      ...(product.size > 0 ? [String(product.size)] : []), ...product.customer_names]);
    productDocuments.set(product, document);
  }
  return document;
}

/** The search cache belongs to one open picker, as in V2. */
export class QolipCellProductPicker {
  private open = true;
  private available: Promise<QolipPlacementProduct[]> | null = null;
  private readonly pages = new Map<string, Promise<QolipPlacementProduct[] | null>>();
  constructor(private readonly readProducts: () => Promise<QolipPlacementProduct[]>,
    private readonly placed: Promise<Set<string>>, private readonly current: () => boolean) {}
  async loadPage(query: string, offset: number, limit: number): Promise<QolipPlacementProduct[]> {
    if (offset < 0 || limit < 0) throw new RangeError('Invalid picker page');
    this.available ??= (async () => qolipProductsAvailableForCellPlacement(await this.readProducts(), await this.placed))();
    const available = await this.available;
    if (!this.open || !this.current()) return [];
    if (this.pages.size >= 8 && !this.pages.has(query)) this.pages.clear();
    let filtered = this.pages.get(query);
    if (!filtered) {
      filtered = filterQolipSearch(available, query, qolipPlacementProductSearchDocument,
        { isCurrent: () => this.open && this.current() });
      this.pages.set(query, filtered);
    }
    return (await filtered)?.slice(offset, offset + limit) ?? [];
  }
  close() { this.open = false; }
}
