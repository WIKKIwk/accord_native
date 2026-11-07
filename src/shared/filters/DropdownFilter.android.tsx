import { Host, Row, Spacer, Text } from '@expo/ui';
import { Box, DropdownMenu, DropdownMenuItem, OutlinedButton, Text as ComposeText } from '@expo/ui/jetpack-compose';
import { combinedClickable, defaultMinSize, fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';
import type { ColorValue } from 'react-native';
import { WorkerQueueCard } from '../../components/WorkerQueueCard.android';

type Option<T> = { value: T; label: string; onLongPress?: () => void };
type Props<T> = {
  label: string; selectedLabel: string; options: readonly Option<T>[]; enabled?: boolean;
  backgroundColor: ColorValue; onChange: (value: T) => void; last?: boolean;
};

/** The selection control shared by worker and preparation lists. */
export function DropdownFilter<T extends string | number>({ label, selectedLabel, options, enabled = true,
  backgroundColor, onChange, last = false }: Props<T>) {
  const [expanded, setExpanded] = useState(false);
  const select = (value: T) => { setExpanded(false); onChange(value); };
  return <WorkerQueueCard first last={last} backgroundColor={backgroundColor}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Row alignment="center" spacing={8} style={{ width: '100%' }}>
      <Text>{label}</Text><Spacer flexible />
      <DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
        <DropdownMenu.Trigger><OutlinedButton enabled={enabled} onClick={() => setExpanded(true)}>
          <ComposeText maxLines={1} overflow="ellipsis">{`${selectedLabel} ▾`}</ComposeText>
        </OutlinedButton></DropdownMenu.Trigger>
        <DropdownMenu.Items>{options.map(option => option.onLongPress
          ? <Box key={String(option.value)} contentAlignment="centerStart" modifiers={[
            fillMaxWidth(), defaultMinSize({ minWidth: 112, minHeight: 48 }),
            combinedClickable({ onClick: () => select(option.value), onLongClick: () => {
              setExpanded(false); requestAnimationFrame(() => option.onLongPress?.());
            } }), padding(12, 8, 12, 8),
          ]}><ComposeText>{option.label}</ComposeText></Box>
          : <DropdownMenuItem key={String(option.value)} onClick={() => select(option.value)}>
            <DropdownMenuItem.Text><ComposeText>{option.label}</ComposeText></DropdownMenuItem.Text>
          </DropdownMenuItem>)}</DropdownMenu.Items>
      </DropdownMenu>
    </Row>
  </Host></WorkerQueueCard>;
}
