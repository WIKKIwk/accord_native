import { router, type Href } from 'expo-router';
import type { PreparationFormulaOptions } from './usePreparationFormula';
export function openPreparationFormula(options: PreparationFormulaOptions) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) if (value !== undefined && value !== null) params.set(key, String(value));
  router.push(`/ios-preparation/formula?${params}` as Href);
}
export function openPreparationRoute(route: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  router.push(`/ios-preparation/${route}${query ? `?${query}` : ''}` as Href);
}
