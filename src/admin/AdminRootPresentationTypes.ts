import type { AdminRootPresentationChain, AdminRootPresentationContent, AdminRootPresentationOptions } from './adminRootPresentationChain';

/** A REAL full-screen native carrier, not the existing Source scaffold/file route or a readiness declaration. */
export type AdminRootPresentationRootProps = Readonly<{
  chain: AdminRootPresentationChain; rootIdentity: object;
  presentation: AdminRootPresentationOptions; renderContent: AdminRootPresentationContent; onRequestClose: () => void;
}>;
