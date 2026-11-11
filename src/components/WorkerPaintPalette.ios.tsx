import { Button, Host, HStack, Picker, Text, VStack } from '@expo/ui/swift-ui';
import { background, buttonStyle, font, foregroundStyle, frame, pickerStyle, shapes, tag } from '@expo/ui/swift-ui/modifiers';
import { paintOptions } from '../workerOrderLogic';
import type { PaintUsage, WorkerPaintPaletteProps } from './workerPaintPaletteTypes';
import { useWorkerOrderText } from './useWorkerOrderText';

const groups = [
  { id: 'colors', title: 'Ranglar' }, { id: 'lacquers', title: 'Laklar' },
  { id: 'solvents', title: 'Erituvchilar / spirtli suyuqliklar' },
];
const tones: Record<string, readonly [string, string]> = {
  Mix: ['#8A6A4A', '#fff'], Pantone: ['#8E6BBE', '#fff'], Oq: ['#F8F7F2', '#332C26'],
  Sariq: ['#FFD54F', '#3B2A00'], Qizil: ['#E53935', '#fff'], 'Ko‘k': ['#1E88E5', '#fff'],
  Tilla: ['#D4A72C', '#332100'], Kumush: ['#C7CDD3', '#273038'], Qora: ['#202124', '#fff'],
  Lak: ['#B7BCC2', '#273038'], Spirtlar: ['#E4B77A', '#3E2815'],
};

// @v2 ReturnedPaintSheet: palettePage categories in returned_paint_sheet.dart.
export function WorkerPaintPalette({ usage, onUsage, onSelect }: WorkerPaintPaletteProps) {
  const { t } = useWorkerOrderText();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <VStack alignment="leading" spacing={12} modifiers={[frame({ maxWidth: Infinity })]}>
      <Picker<PaintUsage> selection={usage} onSelectionChange={value => {
        if (value === 'rasxot' || value === 'astatka') onUsage(value);
      }} modifiers={[pickerStyle('segmented'), frame({ maxWidth: Infinity })]}>
        <Text modifiers={[tag('rasxot')]}>{t('Rasxot')}</Text>
        <Text modifiers={[tag('astatka')]}>{t('Astatka')}</Text>
      </Picker>
      {groups.map(group => {
        const items = paintOptions.filter(option => option.category === group.id);
        const rows = Array.from({ length: Math.ceil(items.length / 3) }, (_, index) => items.slice(index * 3, index * 3 + 3));
        return <VStack key={group.id} alignment="leading" spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text modifiers={[font({ textStyle: 'headline' })]}>{t(group.title)}</Text>
          {rows.map(row => <HStack key={row[0].name} spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
            {row.map(({ name }) => <Button key={name} onPress={() => onSelect(name)}
              modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity })]}>
              <Text modifiers={[font({ size: 12, weight: 'heavy' }), foregroundStyle(tones[name][1]),
                frame({ maxWidth: Infinity, minHeight: 64, maxHeight: 64 }), background(tones[name][0], shapes.capsule())]}>{t(name)}</Text>
            </Button>)}
            {Array.from({ length: 3 - row.length }, (_, index) => <Text key={`empty-${index}`}
              modifiers={[frame({ maxWidth: Infinity, minHeight: 64, maxHeight: 64 })]}>{''}</Text>)}
          </HStack>)}
        </VStack>;
      })}
    </VStack>
  </Host>;
}
