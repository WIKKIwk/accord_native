/**
 * V2 permits real-account commands. Session ownership, persisted retry payloads
 * and printer support are checked at their existing dispatch boundaries.
 */
export function rawSplitWriteDispatchAllowed(): boolean { return true; }
