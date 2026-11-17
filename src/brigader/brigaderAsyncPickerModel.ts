export type BrigaderAsyncPickerSpec<T> = {
    title: string;
    hint: string;
    pageSize: number;
    cacheKey?: string;
    autofocus?: boolean;
    load: (query: string, offset: number, limit: number) => Promise<readonly T[]>;
    key: (item: T) => string;
    titleFor: (item: T) => string;
    subtitle: (item: T) => string;
    addLabel?: string;
    onAdd?: () => void;
};
export let cacheGeneration = 0;
export const memory = new Map<string, {
    rows: readonly unknown[];
    hasMore: boolean;
}>();
export function clearBrigaderPickerMemory() { cacheGeneration++; memory.clear(); }
