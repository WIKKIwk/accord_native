import { Button, Column, Host } from '@expo/ui';
import { paintOptions } from '../workerOrderLogic';

import type { WorkerPaintPaletteProps } from './workerPaintPaletteTypes';
export type { PaintUsage, WorkerPaintPaletteProps } from './workerPaintPaletteTypes';

export function WorkerPaintPalette({ usage, onUsage, onSelect }: WorkerPaintPaletteProps) {
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Column spacing={8}>
      <Button label="Rasxot" variant={usage === 'rasxot' ? 'filled' : 'outlined'} onPress={() => onUsage('rasxot')} />
      <Button label="Astatka" variant={usage === 'astatka' ? 'filled' : 'outlined'} onPress={() => onUsage('astatka')} />
      {paintOptions.map(option => <Button key={option.name} label={option.name} variant="outlined" onPress={() => onSelect(option.name)} />)}
    </Column>
  </Host>;
}
