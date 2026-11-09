/**
 * Real stock/issue dispatch remains held until durable result acknowledgement and
 * same-scope reconciliation are proven. This has no runtime or UI override.
 */
export function rawSplitWriteDispatchAllowed(): boolean { return false; }
