export type PaintUsage = 'rasxot' | 'astatka';
export type WorkerPaintPaletteProps = {
  usage: PaintUsage;
  onUsage: (value: PaintUsage) => void;
  onSelect: (name: string) => void;
};

