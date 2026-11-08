import { Button, Host, HStack, Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, background, buttonStyle, font, foregroundStyle, frame, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { paintOptions } from '../workerOrderLogic';
import type { BoyoqchiPaintPaletteProps } from './boyoqchiPaintPaletteTypes';
import { boyoqchiPaintCompletion } from './boyoqchiPaintPaletteLogic';
import { useBoyoqchiText } from './useBoyoqchiText';

// @v2 ReturnedPaintSheet: category and swatch values from returned_paint_sheet.dart.
const groups = [
  { id: 'colors', title: 'Ranglar' }, { id: 'lacquers', title: 'Laklar' },
  { id: 'solvents', title: 'Erituvchilar / spirtli suyuqliklar' },
] as const;
const tones: Record<string, readonly [string, string]> = {
  Mix: ['#8A6A4A', '#FFFFFF'], Pantone: ['#8E6BBE', '#FFFFFF'], Oq: ['#F8F7F2', '#332C26'],
  Sariq: ['#FFD54F', '#3B2A00'], Qizil: ['#E53935', '#FFFFFF'], 'Ko‘k': ['#1E88E5', '#FFFFFF'],
  Tilla: ['#D4A72C', '#332100'], Kumush: ['#C7CDD3', '#273038'], Qora: ['#202124', '#FFFFFF'],
  Lak: ['#B7BCC2', '#273038'], Spirtlar: ['#E4B77A', '#3E2815'],
};

export function BoyoqchiPaintPalette({ usage, draft, onUsage, onSelect }: BoyoqchiPaintPaletteProps) {
  const t = useBoyoqchiText();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <VStack alignment="leading" spacing={12} modifiers={[frame({ maxWidth: Infinity })]}>
      <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
        {(['rasxot', 'astatka'] as const).map(value => <Button key={value} onPress={() => onUsage(value)}
          modifiers={[buttonStyle(usage === value ? 'borderedProminent' : 'bordered'), frame({ maxWidth: Infinity })]}>
          <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 38 })]}>{t(value === 'rasxot' ? 'Rasxot' : 'Astatka')}</Text>
        </Button>)}
      </HStack>
      {groups.map(group => {
        const items = paintOptions.filter(option => option.category === group.id);
        const rows = Array.from({ length: Math.ceil(items.length / 3) }, (_, index) => items.slice(index * 3, index * 3 + 3));
        return <VStack key={group.id} alignment="leading" spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text modifiers={[font({ weight: 'bold' })]}>{t(group.title)}</Text>
          {rows.map(row => <HStack key={row[0].name} spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
            {row.map(option => {
              const { name } = option, indicator = boyoqchiPaintCompletion(draft, usage, option);
              return <Button key={name} onPress={() => onSelect(name)} modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity })]}>
                <ZStack alignment="topTrailing" modifiers={[frame({ maxWidth: Infinity, minHeight: 64, maxHeight: 64 }),
                  background(tones[name][0], shapes.capsule())]}>
                  <Text modifiers={[font({ size: 12, weight: 'heavy' }), foregroundStyle(tones[name][1]),
                    frame({ maxWidth: Infinity, minHeight: 64, maxHeight: 64 })]}>{t(name)}</Text>
                  {indicator && <Image systemName={indicator === 'complete' ? 'checkmark' : 'star.fill'}
                    size={indicator === 'complete' ? 17 : 16} color={tones[name][1]}
                    modifiers={[padding({ top: 8, trailing: 12 }), accessibilityHidden(true)]} />}
                </ZStack>
              </Button>;
            })}
            {Array.from({ length: 3 - row.length }, (_, index) => <Text key={`empty-${index}`}
              modifiers={[frame({ maxWidth: Infinity, minHeight: 64, maxHeight: 64 })]}>{''}</Text>)}
          </HStack>)}
        </VStack>;
      })}
    </VStack>
  </Host>;
}
