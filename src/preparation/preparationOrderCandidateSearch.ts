import { gscalePickerRelevance } from '../gscale/gscalePhotoSearch';
import { searchMatches } from '../shared/searchNormalizer';
import type { preparationAssignmentCandidates } from './preparationInventoryAssignment';

export type PreparationOrderCandidate = Awaited<ReturnType<typeof preparationAssignmentCandidates>>[number];

/** @v2 _orderLabel */
export function preparationOrderCandidateLabel(candidate: PreparationOrderCandidate): string {
  const map = candidate.order.map;
  const code = map.code.trim() || map.order_number.trim() || map.id.trim();
  return `${code} · ${map.title.trim() || 'Buyurtma'}`;
}

/** @v2 _openOrderPicker */
export function preparationOrderPickerResults(candidates: readonly PreparationOrderCandidate[], query: string, limit: number) {
  const matches = candidates.filter(candidate => {
    const map = candidate.order.map;
    return searchMatches(query, [map.id, map.code, map.order_number, map.title, map.product_code, preparationOrderCandidateLabel(candidate)]);
  });
  const page = matches.slice(0, limit).map((candidate, index) => ({
    candidate, index, score: gscalePickerRelevance(query, preparationOrderCandidateLabel(candidate), candidate.order.map.id.trim()),
  }));
  if (query.trim()) page.sort((left, right) => right.score - left.score || left.index - right.index);
  return { items: page.map(entry => entry.candidate), hasMore: matches.length > limit };
}
