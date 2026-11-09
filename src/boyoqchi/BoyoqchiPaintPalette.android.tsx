import { Box, Button, Column, Host, RNHostView, Row, SegmentedButton, SingleChoiceSegmentedButtonRow, Spacer, Text } from '@expo/ui/jetpack-compose';
import { align, fillMaxWidth, height, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useBaseTheme } from '../components/useBaseTheme';
import { paintOptions } from '../workerOrderLogic';
import { boyoqchiPaintCompletion, boyoqchiPaintGroups as groups, boyoqchiPaintTones as tones } from './boyoqchiPaintPaletteLogic';
import type { BoyoqchiPaintPaletteProps } from './boyoqchiPaintPaletteTypes';
import { useBoyoqchiText } from './useBoyoqchiText';

// @v2 ReturnedPaintSheet: role-owned adapter keeps the protected Worker palette unchanged.
export function BoyoqchiPaintPalette({ usage, draft, onUsage, onSelect }: BoyoqchiPaintPaletteProps) {
  const t = useBoyoqchiText(), { direction } = useBaseTheme(), rtl = direction === 'rightToLeft';
  return <Host matchContents={{ vertical: true }} layoutDirection={direction} style={{ width: '100%' }}>
    <Column verticalArrangement={{ spacedBy: 12 }}>
      <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
        {(['rasxot', 'astatka'] as const).map(value => <SegmentedButton key={value} selected={usage === value} onClick={() => onUsage(value)}>
          <SegmentedButton.Label><Text>{t(value === 'rasxot' ? 'Rasxot' : 'Astatka')}</Text></SegmentedButton.Label>
        </SegmentedButton>)}
      </SingleChoiceSegmentedButtonRow>
      {groups.map(group => {
        const items = paintOptions.filter(option => option.category === group.id);
        const rows = Array.from({ length: Math.ceil(items.length / 3) }, (_, index) => items.slice(index * 3, index * 3 + 3));
        return <Column key={group.id} verticalArrangement={{ spacedBy: 10 }}>
          <Text style={{ fontWeight: '700' }}>{t(group.title)}</Text>
          {rows.map(row => <Row key={row[0].name} modifiers={[fillMaxWidth()]} horizontalArrangement={{ spacedBy: 10 }}>
            {row.map(option => {
              const { name } = option, indicator = boyoqchiPaintCompletion(draft, usage, option);
              return <Button key={name} onClick={() => onSelect(name)} modifiers={[weight(1), height(64)]}
                contentPadding={{ start: 0, top: 0, end: 0, bottom: 0 }}
                colors={{ containerColor: tones[name][0], contentColor: tones[name][1] }}>
                <Box contentAlignment="center" modifiers={[fillMaxWidth(), height(64)]}>
                  <Text style={{ fontSize: 12, fontWeight: '800' }}>{t(name)}</Text>
                  {indicator && <RNHostView matchContents modifiers={[align(rtl ? 'topStart' : 'topEnd'), padding(rtl ? 12 : 0, 8, rtl ? 0 : 12, 0)]}>
                    <SymbolView name={{ android: indicator === 'complete' ? 'check' : 'star' }}
                      size={indicator === 'complete' ? 17 : 16} tintColor={tones[name][1]}
                      pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" />
                  </RNHostView>}
                </Box>
              </Button>;
            })}
            {Array.from({ length: 3 - row.length }, (_, index) => <Spacer key={index} modifiers={[weight(1)]} />)}
          </Row>)}
        </Column>;
      })}
    </Column>
  </Host>;
}
