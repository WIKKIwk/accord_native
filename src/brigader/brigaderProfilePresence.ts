const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
/** V2 ProfileRouteOverlayNotifier counts mounted profile routes, including ones below the focused route. */
export function brigaderProfileOnStack(state: unknown, workspace: string, ownedProfile?: (id: string) => boolean): boolean {
  const visit = (value: unknown, inside: boolean): boolean => {
    if (!object(value) || !Array.isArray(value.routes)) return false;
    return value.routes.some(route => {
      if (!object(route)) return false;
      const activeWorkspace = inside || route.name === workspace;
      if (activeWorkspace && route.name === 'profile') return true;
      if (activeWorkspace && route.name === 'owned/[id]' && object(route.params) && typeof route.params.id === 'string' && ownedProfile?.(route.params.id)) return true;
      return visit(route.state, activeWorkspace);
    });
  };
  return visit(state, false);
}
