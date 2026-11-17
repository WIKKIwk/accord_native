import type { BrigaderDialogProps } from './BrigaderDialogTypes';
export function BrigaderSurfaceContent({ draw, interactive, shown }: { draw: BrigaderDialogProps['children']; interactive: () => boolean; shown: boolean }) {
  return draw(interactive, shown);
}
