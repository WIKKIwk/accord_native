import type { Href } from 'expo-router';
// New file-system routes may precede Metro's ignored generated route declarations.
export const workerPaddonListRoute = (apparatus = '', name = '') => (`/ios-worker/paddons?${new URLSearchParams({ apparatus, name })}` as Href);
export const workerPaddonDetailRoute = (code: string, apparatus: string, name: string) => (`/ios-worker/paddon/${encodeURIComponent(code)}?${new URLSearchParams({ apparatus, name })}` as Href);
export const workerPaddonTransferRoute = (apparatus: string) => (`/ios-worker/paddon-transfer?${new URLSearchParams({ apparatus })}` as Href);
