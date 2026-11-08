import type { productionMapDefinitionFromJson } from '../workerProductionMapSaved';
import { dartTrim, isAscii, isAsciiCanonicalApparatusId } from './dartApparatus';

type ProductionMap = ReturnType<typeof productionMapDefinitionFromJson>;
type Node = ProductionMap['nodes'][number];

function routeBranchAllowed(node: Node, branch: string): boolean {
  if (node.kind !== 'condition') return true;
  const normalized = dartTrim(branch);
  return isAscii(normalized) && ['ha', 'yes', 'true', '1', "yo'q", 'yoq', 'no', 'false', '0'].includes(normalized.toLowerCase());
}

/**
 * Returns only the part of the V2 chain used by the assignment apparatus filter.
 * It is not a general production-map routing or WIP implementation.
 *
 * @v2 productionMapAuthorizedOrderApparatus
 */
export function productionMapAuthorizedOrderApparatus(map: ProductionMap, assignedApparatus: readonly string[]): readonly string[] {
  const assigned = new Set(assignedApparatus.filter(isAsciiCanonicalApparatusId).map(dartTrim));
  const firstStart = map.nodes.find(node => node.kind === 'start');
  if (!firstStart) return Object.freeze([]);

  // V2's reachability walk uses the first node with an id, but its stage lookup
  // uses the last node with that id. Preserve those distinctions for malformed maps.
  const byId = new Map(map.nodes.map(node => [node.id, node]));
  const firstNode = (id: string) => map.nodes.find(node => node.id === id);
  const queue = [firstStart.id], visited = new Set<string>(), occurrences = new Set<string>();
  const result: string[] = [], seenApparatusIds = new Set<string>();
  let encounteredApparatus = false;

  for (let index = 0; index < queue.length; index++) {
    const id = queue[index], source = firstNode(id);
    if (visited.has(id) || !source) continue;
    visited.add(id);
    const node = byId.get(id);
    if (node && (node.kind === 'apparatus' || (node.kind === 'task' && encounteredApparatus))) {
      const group = node.kind === 'apparatus' ? dartTrim(node.alternative_group_id) : '';
      const stages: { nodeId: string; apparatusId: string | null }[] = group
        ? map.nodes.filter(candidate => candidate.kind === 'apparatus' && dartTrim(candidate.alternative_group_id) === group &&
            isAsciiCanonicalApparatusId(candidate.apparatus_id))
          .map(candidate => ({ nodeId: candidate.id, apparatusId: dartTrim(candidate.apparatus_id) }))
        : node.kind === 'apparatus'
          ? (() => {
              const assignedId = dartTrim(node.alternative_assigned_apparatus_id);
              const apparatusId = assignedId || dartTrim(node.apparatus_id);
              return isAsciiCanonicalApparatusId(apparatusId) ? [{ nodeId: node.id, apparatusId }] : [];
            })()
          : [{ nodeId: node.id, apparatusId: null }];
      if (node.kind === 'apparatus' && stages.length) encounteredApparatus = true;
      for (const stage of stages) {
        const occurrence = dartTrim(stage.nodeId);
        if (occurrences.has(occurrence)) continue;
        occurrences.add(occurrence);
        if (stage.apparatusId && assigned.has(stage.apparatusId) && !seenApparatusIds.has(stage.apparatusId)) {
          seenApparatusIds.add(stage.apparatusId);
          result.push(stage.apparatusId);
        }
      }
    }
    const group = source.kind === 'apparatus' ? dartTrim(source.alternative_group_id) : '';
    const operation = new Set(group
      ? map.nodes.filter(candidate => candidate.kind === 'apparatus' && dartTrim(candidate.alternative_group_id) === group)
        .map(candidate => candidate.id)
      : [source.id]);
    for (const edge of map.edges) {
      if (!operation.has(edge.from) || operation.has(edge.to)) continue;
      const from = firstNode(edge.from);
      if (from && routeBranchAllowed(from, edge.branch)) queue.push(edge.to);
    }
  }
  return Object.freeze(result);
}
