import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { adminCustomerDetail } from '../admin/adminCustomerDetailApi';
import { supplierItemFromJson, type SupplierItem } from '../shared/catalogApi';
import { searchMatches } from '../shared/searchNormalizer';
export type CalculateProductOption = {
    item: SupplierItem;
    customerName: string;
};
export async function calculateProductPickerPage(session: Session, customerRef: string, customerName: string, includeCombos: boolean, query: string, offset: number, limit: number, guard: () => void, current: () => boolean): Promise<CalculateProductOption[]> {
    guard();
    let rows: readonly SupplierItem[];
    const eligible = (item: SupplierItem) => item.item_group.trim().toLowerCase() === 'tayyor mahsulot' || includeCombos && item.item_group.trim().toLowerCase() === 'kombo';
    if (customerRef.trim()) {
        const detail = await adminCustomerDetail(session, customerRef.trim(), guard, current);
        guard();
        const needle = query.trim().toLowerCase();
        const filtered = detail.assigned_items.filter(item => eligible(item) && (!needle || searchMatches(needle, [item.name, item.code, item.uom, item.warehouse])));
        rows = filtered.slice(offset, limit <= 0 ? undefined : offset + limit);
    }
    else {
        const queryParams = new URLSearchParams();
        if (query.trim())
            queryParams.set('q', query.trim());
        queryParams.set('group', 'Tayyor mahsulot');
        if (limit > 0)
            queryParams.set('limit', String(limit));
        if (offset > 0)
            queryParams.set('offset', String(offset));
        const response = await authorizedFetch(session, `/v1/mobile/admin/items?${queryParams}`, {}, guard, 10000, { readWitness: current });
        guard();
        if (response.status !== 200)
            throw new Error('Admin items failed');
        const value: unknown = await response.json();
        guard();
        if (!Array.isArray(value))
            throw new TypeError('Invalid item list');
        rows = value.map(supplierItemFromJson).filter(eligible);
    }
    return rows.map(item => ({ item, customerName: customerName.trim() || (item.customer_names.length ? item.customer_names.join(', ') : 'Mijoz biriktirilmagan') }));
}
