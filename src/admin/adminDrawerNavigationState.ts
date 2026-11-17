/** Public Expo Router navigation state, including partially hydrated nested navigators. */
export type AdminDrawerNavigationState = {
  key?: string; type?: string; index?: number;
  routes: readonly { name: string; state?: AdminDrawerNavigationState }[];
};
export type AdminDrawerStack = { key: string; currentPath: string; paths: readonly string[] };

function path(parts: readonly string[]): string {
  return `/${parts.flatMap(part => part.split('/')).filter(part => part && part !== 'index' && !/^\(.*\)$/.test(part)).join('/')}`;
}
function activeIndex(state: AdminDrawerNavigationState): number | null {
  const index = state.index;
  return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < state.routes.length ? index : null;
}

/** The drawer lives above its child navigator: inspect the focused root chain, never parent/preloaded routes. */
export function adminDrawerActiveStack(root: AdminDrawerNavigationState | undefined, platform: string, workspace: 'admin' | 'brigader' = 'admin'): AdminDrawerStack | null {
  if (platform !== 'ios' && platform !== 'android') return null;
  const role = `${platform}-${workspace}`; let state = root, prefix: string[] = [], inside = false, stack: AdminDrawerStack | null = null;
  // Only descend the selected tab/route. An inactive iOS Home stack is not Activity's history.
  for (let depth = 0; state && depth < 32; depth++) {
    const index = activeIndex(state); if (index === null) return null;
    const route = state.routes[index];
    if (inside && state.type === 'stack' && state.key) {
      const paths = state.routes.slice(0, index + 1).map(entry => path([...prefix, entry.name]));
      stack = { key: state.key, paths, currentPath: paths[index] };
    }
    if (!inside && route.name === role) { inside = true; prefix = [role]; }
    else prefix = [...prefix, route.name];
    state = route.state;
  }
  return inside ? stack : null;
}
