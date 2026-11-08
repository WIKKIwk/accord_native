import { isCanonicalApparatusId } from '../workerControlsApi';

/** The fields already parsed by productionMapDefinitionFromJson. */
export type RezkaOrderMapNode = { id: string; kind: string; title: string; apparatus_id: string;
  alternative_group_id: string; alternative_assigned_apparatus_id: string };
export type RezkaOrderMap = { id: string; nodes: readonly RezkaOrderMapNode[];
  edges: readonly { from: string; to: string; branch: string }[] };
export type RezkaOrderEntry =
  | { kind: 'watch'; workerMode: boolean; isWorkerListPresentationOrder: boolean; apparatus: { id: string; operation: string };
      frozen: boolean; lifecycleStatus: string | null }
  | { kind: 'completed'; apparatus: { operation: string } | null };

/** @v2 productionMapLinearWorkStages: only the apparatus identities needed by the master permission check. */
export function rezkaLinearStageApparatus(map: RezkaOrderMap): string[] {
  const firstNode = (id: string) => map.nodes.find(node => node.id === id);
  const byId = new Map(map.nodes.map(node => [node.id, node]));
  const start = map.nodes.find(node => node.kind === 'start');
  if (!start) return [];
  const queue = [start.id], visited = new Set<string>(), seenOccurrences = new Set<string>(), result: string[] = [];
  let seenApparatus = false;
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index], first = firstNode(id);
    if (visited.has(id) || !first) continue;
    visited.add(id);
    const node = byId.get(id);
    if (node && (node.kind === 'apparatus' || (node.kind === 'task' && seenApparatus))) {
      const group = node.alternative_group_id.trim();
      const candidates = node.kind === 'apparatus' && group
        ? map.nodes.filter(candidate => candidate.kind === 'apparatus' && candidate.alternative_group_id.trim() === group &&
          isCanonicalApparatusId(candidate.apparatus_id)).map(candidate => ({ node: candidate, stage: candidate.apparatus_id.trim() }))
        : [{ node, stage: node.kind === 'apparatus'
          ? (node.alternative_assigned_apparatus_id.trim() || node.apparatus_id.trim()) : `task:${node.id.trim()}` }]
          .filter(item => item.node.kind !== 'apparatus' || isCanonicalApparatusId(item.stage));
      if (node.kind === 'apparatus' && candidates.length) seenApparatus = true;
      for (const candidate of candidates) {
        const occurrence = candidate.node.id.trim();
        if (!candidate.stage || seenOccurrences.has(occurrence)) continue;
        seenOccurrences.add(occurrence);
        if (candidate.node.kind === 'apparatus') result.push(candidate.stage);
      }
    }
    const group = first.kind === 'apparatus' ? first.alternative_group_id.trim() : '';
    const operation = group ? new Set(map.nodes.filter(candidate => candidate.kind === 'apparatus' &&
      candidate.alternative_group_id.trim() === group).map(candidate => candidate.id)) : new Set([first.id]);
    for (const edge of map.edges) {
      if (!operation.has(edge.from) || operation.has(edge.to)) continue;
      const from = firstNode(edge.from);
      if (!from) continue;
      const branch = edge.branch.trim().toLowerCase();
      if (from.kind === 'condition' && !['ha', 'yes', 'true', '1', "yo'q", 'yoq', 'no', 'false', '0'].includes(branch)) continue;
      queue.push(edge.to);
    }
  }
  return result;
}

/** @v2 _canEditRezkaPrintSide and the watch/completed sheet call sites. */
export function rezkaOrderSettingsVisibility(map: RezkaOrderMap, entry: RezkaOrderEntry, role: unknown,
  assignedApparatus: readonly string[]): { showPrintSide: boolean; showWorkOptions: boolean } {
  const hidden = { showPrintSide: false, showWorkOptions: false };
  const id = map.id.trim();
  if (role !== 'rezka_master' || id.startsWith('training-') || id.startsWith('template-') ||
      !rezkaLinearStageApparatus(map).some(stage => assignedApparatus.includes(stage))) return hidden;
  if (entry.kind === 'completed') {
    return entry.apparatus?.operation.trim() === 'cut' ? { showPrintSide: true, showWorkOptions: false } : hidden;
  }
  const apparatusId = entry.apparatus.id.trim();
  if (!entry.workerMode || entry.isWorkerListPresentationOrder || !apparatusId ||
      !assignedApparatus.some(assigned => assigned.trim() === apparatusId) || entry.apparatus.operation.trim().toLowerCase() !== 'cut') return hidden;
  const finished = ['production_completed', 'closed', 'cancelled'].includes(entry.lifecycleStatus?.trim().toLowerCase() ?? '');
  return { showPrintSide: true, showWorkOptions: !entry.frozen && !finished };
}
