import { Column, FilterChip, Row, SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, semantics } from '@expo/ui/jetpack-compose/modifiers';
import type { AdminWorkMapControlsProps } from './adminWorkMapControlsTypes';

export function AdminWorkMapModules(props: AdminWorkMapControlsProps) {
  return <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth(), padding(12, 4, 12, 4)]}>
    <SegmentedButton selected={props.module === 'sequence'} onClick={() => props.onModule('sequence')}><SegmentedButton.Label><Text>Ketma-ketlik</Text></SegmentedButton.Label></SegmentedButton>
    <SegmentedButton selected={props.module === 'orders'} onClick={() => props.onModule('orders')}><SegmentedButton.Label><Text>Buyurtmalar</Text></SegmentedButton.Label></SegmentedButton>
  </SingleChoiceSegmentedButtonRow>;
}
export function AdminWorkMapApparatusFilter(props: AdminWorkMapControlsProps) {
  return <Column modifiers={[fillMaxWidth(), padding(12, 4, 12, 4)]}>
    <FilterChip selected={props.expanded} onClick={props.onToggle} modifiers={[semantics({ contentDescription: [props.apparatusLabel, props.selected?.name ?? props.unselectedLabel].join(', ') })]}>
      <FilterChip.Label><Row><Text>{props.apparatusLabel}</Text><Text>{props.selected?.name ?? props.unselectedLabel}</Text></Row></FilterChip.Label>
    </FilterChip>
    {props.expanded && props.catalog.map(item => <FilterChip key={item.id} selected={props.selected?.id === item.id} onClick={() => props.onApparatus(item.id)}>
      <FilterChip.Label><Text>{item.name}</Text></FilterChip.Label>
    </FilterChip>)}
    {!!props.countText && <Text>{props.countText}</Text>}
  </Column>;
}
