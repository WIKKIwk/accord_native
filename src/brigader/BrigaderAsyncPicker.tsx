import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { PickerSheetContent } from '../shared/orders/PickerSheetContent';
import { adminItemCreateSortedPicker } from '../admin/adminItemCreateModel';
import { localizedGetter } from '../shared/localization';
import { BrigaderModel } from './brigaderModel';
import { BrigaderActionIcon } from './BrigaderActionIcon';
import { BrigaderPresentations, type BrigaderPresentation } from './brigaderPresentations';
import { cacheGeneration, memory, type BrigaderAsyncPickerSpec } from './brigaderAsyncPickerModel';
class PickerModel extends BrigaderModel<{
    query: string;
    rows: readonly unknown[];
    loading: boolean;
    error: unknown;
    hasMore: boolean;
}> {
    private serial = 0;
    private timer: ReturnType<typeof setTimeout> | null = null;
    constructor(readonly spec: BrigaderAsyncPickerSpec<unknown>, current: () => boolean, interactive: () => boolean) { super({ query: '', rows: [], loading: true, error: null, hasMore: true }, current, interactive); }
    start = () => { const cached = this.spec.cacheKey ? memory.get(this.spec.cacheKey) : null; if (cached)
        this.patch({ rows: cached.rows, hasMore: cached.hasMore, loading: false });
    else
        void this.read(true); };
    search = (query: string) => { if (!this.interactive())
        return; this.patch({ query }); this.serial++; if (this.timer)
        clearTimeout(this.timer); this.timer = setTimeout(() => { this.timer = null; void this.read(true); }, 220); };
    read = async (replace: boolean) => { if (!this.current() || !replace && (this.state.loading || !this.state.hasMore))
        return; const serial = ++this.serial, query = this.state.query.trim(), generation = cacheGeneration, offset = replace ? 0 : this.state.rows.length; this.patch({ loading: true, ...(replace ? { rows: [], error: null } : {}) }); try {
        const page = await this.spec.load(query, offset, this.spec.pageSize);
        if (!this.current() || serial !== this.serial)
            return;
        const rows = replace ? [...page] : [...this.state.rows, ...page], hasMore = page.length >= this.spec.pageSize;
        this.patch({ rows, hasMore, loading: false });
        if (!query && this.spec.cacheKey && rows.length && generation === cacheGeneration)
            memory.set(this.spec.cacheKey, { rows, hasMore });
    }
    catch (error) {
        if (serial === this.serial)
            this.patch({ loading: false, error });
    } };
    override dispose() { super.dispose(); this.serial++; if (this.timer)
        clearTimeout(this.timer); }
}
export function BrigaderAsyncPicker({ entry, owner, interactive, locale }: {
    entry: BrigaderPresentation;
    owner: BrigaderPresentations;
    interactive: () => boolean;
    locale: string;
}) {
    const spec = entry.data as BrigaderAsyncPickerSpec<unknown>, model = useMemo(() => new PickerModel(spec, () => owner.currentEntry(entry.id), interactive), [spec, owner, entry.id, interactive]), state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot), size = useWindowDimensions();
    useEffect(() => model.attach(model.start), [model]);
    const rows = adminItemCreateSortedPicker(state.rows, state.query, spec.titleFor, spec.subtitle);
    const add = spec.onAdd ? <BrigaderActionIcon label={spec.addLabel ?? ''} icon={{ ios: 'plus', android: 'add' }} onPress={() => { if (interactive()) {
        spec.onAdd?.();
        owner.close(entry.id);
    } }}/> : undefined;
    return <View style={{ height: size.height * .86 }}><PickerSheetContent title={spec.title} hint={spec.hint} autoFocus={spec.autofocus} headerAction={add} closeLabel={localizedGetter('closeAction', locale)} emptyLabel={localizedGetter('noRecordsYet', locale)} query={state.query} onSearch={model.search} items={(state.error ? [] : rows).map(item => ({ key: spec.key(item), title: spec.titleFor(item), subtitle: spec.subtitle(item), select: () => { if (interactive())
            owner.close(entry.id, item); } }))} loading={state.loading} error={state.error ? localizedGetter('serverDisconnectedRetry', locale) : undefined} retryLabel={localizedGetter('retry', locale)} onRetry={() => { void model.read(true); }} hasMore={state.hasMore} onLoadMore={() => { void model.read(false); }} onClose={() => { if (interactive())
        owner.close(entry.id); }}/></View>;
}
