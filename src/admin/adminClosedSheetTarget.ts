import type { NavigationAction, NavigationState } from 'expo-router';

type Navigation = { getState(): NavigationState | undefined; dispatch(action: NavigationAction): void };

/** Requests removal of the exact active sheet route. It does not assert native transition completion. */
export function requestAdminClosedSheetTargetedPop(navigation: Navigation, routeKey: string, sheetId: string) {
  try {
    const state = navigation.getState();
    if (!state || state.type !== 'stack' || typeof state.key !== 'string' || !state.key || typeof routeKey !== 'string' || !routeKey ||
        typeof sheetId !== 'string' || !sheetId || !Array.isArray(state.routes) || !Number.isInteger(state.index) ||
        state.index < 0 || state.index >= state.routes.length) return false;
    const index = state.routes.findIndex(route => route.key === routeKey);
    const route = state.routes[index];
    if (index <= 0 || index > state.index || route?.name !== 'sheet/[id]' || !route.params ||
        !('id' in route.params) || route.params.id !== sheetId) return false;
    // Expo Router 58's StackRouter applies this POP to source within target and retains later routes.
    navigation.dispatch({ type: 'POP', payload: { count: 1 }, source: routeKey, target: state.key });
    return true;
  } catch { return false; }
}
