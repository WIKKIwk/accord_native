/** Imperative callbacks belong to the original controller lifetime, independent of view rerenders. */
export function createQolipStorageBinding<T extends object>(initial: T) {
  let value = initial;
  return { read: () => value, update: (patch: Partial<T>) => { value = { ...value, ...patch }; } };
}
