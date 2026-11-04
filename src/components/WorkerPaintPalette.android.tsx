import { Button, Column, Host, Row, SegmentedButton, SingleChoiceSegmentedButtonRow, Spacer, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, weight } from '@expo/ui/jetpack-compose/modifiers';
import { paintOptions } from '../workerOrderLogic';
import type { PaintUsage, WorkerPaintPaletteProps } from './WorkerPaintPalette';

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
const usages: { id: PaintUsage; label: string }[] = [{ id: 'rasxot', label: 'Rasxot' }, { id: 'astatka', label: 'Astatka' }];

export function WorkerPaintPalette({ usage, onUsage, onSelect }: WorkerPaintPaletteProps) {
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Column verticalArrangement={{ spacedBy: 12 }}>
      <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
        {usages.map(item => <SegmentedButton key={item.id} selected={usage === item.id} onClick={() => onUsage(item.id)}>
          <SegmentedButton.Label><Text>{item.label}</Text></SegmentedButton.Label>
        </SegmentedButton>)}
      </SingleChoiceSegmentedButtonRow>
      {groups.map(group => {
        const items = paintOptions.filter(option => option.category === group.id);
        const rows = Array.from({ length: Math.ceil(items.length / 3) }, (_, index) => items.slice(index * 3, index * 3 + 3));
        return <Column key={group.id} verticalArrangement={{ spacedBy: 10 }}>
          <Text style={{ fontWeight: '700' }}>{group.title}</Text>
          {rows.map(row => <Row key={row[0].name} modifiers={[fillMaxWidth()]} horizontalArrangement={{ spacedBy: 10 }}>
            {row.map(({ name }) => <Button key={name} onClick={() => onSelect(name)} modifiers={[weight(1), height(64)]}
              colors={{ containerColor: tones[name][0], contentColor: tones[name][1] }}>
              <Text style={{ fontSize: 12, fontWeight: '800' }}>{name}</Text>
            </Button>)}
            {Array.from({ length: 3 - row.length }, (_, index) => <Spacer key={index} modifiers={[weight(1)]} />)}
          </Row>)}
        </Column>;
      })}
    </Column>
  </Host>;
}
