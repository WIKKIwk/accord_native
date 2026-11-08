import { WorkerPaintPalette } from '../components/WorkerPaintPalette';
import type { BoyoqchiPaintPaletteProps } from './boyoqchiPaintPaletteTypes';

export function BoyoqchiPaintPalette(props: BoyoqchiPaintPaletteProps) {
  return <WorkerPaintPalette usage={props.usage} onUsage={props.onUsage} onSelect={props.onSelect} />;
}
