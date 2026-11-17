import type { ReactNode } from 'react';
export type BrigaderDialogProps = { identity: object; closing: boolean; current: () => boolean; dismiss: () => void; detached: () => void; children: (interactive: () => boolean, shown: boolean) => ReactNode; dismissible?: boolean; backDismissible?:boolean; hideDragHandle?:boolean; scrim?: number; maxWidth?: number; inset?: number;fullScreen?:boolean };

export class BrigaderSurfaceAuthority {
  private shown = false;
  private closing = false;
  constructor(private readonly original: Pick<BrigaderDialogProps, 'current' | 'detached'>) {}
  update(closing: boolean) { this.closing = closing; }
  appeared = () => { if (this.original.current()) this.shown = true; };
  current = () => this.original.current();
  interactive = () => this.shown && !this.closing && this.original.current();
  dismissible = () => !this.closing && this.original.current();
  detached = () => { if (this.original.current()) this.original.detached(); };
}
