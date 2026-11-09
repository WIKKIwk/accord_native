import type { SafeActivityHiddenStore } from './adminActivityController';

/** Supplied only after the shared store and transition witness have been independently reviewed. */
export type AdminActivityBinding = {
  hidden: SafeActivityHiddenStore;
  generation: () => string | number | null;
  subscribe: (listener: () => void) => () => void;
};
