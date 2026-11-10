import { Badge, BadgedBox, Box, CircularProgressIndicator, Column, IconButton, LazyColumn, ListItem, ModalBottomSheet, RNHostView, Text, useMaterialColors, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { clickable, fillMaxSize, fillMaxWidth, height, padding, semantics, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from './BaseHost';
import type { WorkerActivePaddonProps } from './workerActivePaddonProps';
import { useWorkerOrderText } from './useWorkerOrderText';

export function WorkerActivePaddonButton({ state, controller, label, onOpen }: WorkerActivePaddonProps) {
  const colors = useMaterialColors();
  return <BaseHost matchContents style={{ width: 44, height: 48 }}>
    <IconButton enabled={!state.busy} onClick={onOpen ?? (() => { void controller.open(); })} modifiers={[size(44, 48), semantics({ contentDescription: label })]}>
      <BadgedBox><RNHostView matchContents><SymbolView name={{ android: 'pallet' }} size={22} tintColor={state.code === null ? colors.onSurfaceVariant : colors.primary} /></RNHostView>
        {state.code !== null || state.selection === 'error' ? <BadgedBox.Badge><Badge containerColor={state.selection === 'error' ? colors.error : colors.primary}>
          {state.selection === 'error' ? <Text>!</Text> : null}
        </Badge></BadgedBox.Badge> : null}
      </BadgedBox>
    </IconButton>
  </BaseHost>;
}

function PaddonChoice({ code, title, subtitle, selected, onChoose }: { code: string | null; title: string; subtitle?: string; selected: boolean; onChoose(code: string | null): Promise<void> }) {
  const colors = useMaterialColors();
  return <ListItem modifiers={[clickable(() => { void onChoose(code); })]}>
    <ListItem.LeadingContent><RNHostView matchContents><SymbolView name={{ android: code === null ? 'link_off' : 'pallet' }} size={22} tintColor={colors.onSurfaceVariant} /></RNHostView></ListItem.LeadingContent>
    <ListItem.HeadlineContent><Text>{title}</Text></ListItem.HeadlineContent>
    {subtitle ? <ListItem.SupportingContent><Text>{subtitle}</Text></ListItem.SupportingContent> : null}
    {selected ? <ListItem.TrailingContent><RNHostView matchContents><SymbolView name={{ android: 'check' }} size={22} tintColor={colors.primary} /></RNHostView></ListItem.TrailingContent> : null}
  </ListItem>;
}

export function WorkerActivePaddonPicker({ state, controller }: WorkerActivePaddonProps) {
  const { p } = useWorkerOrderText(), { width, height: screenHeight } = useWindowDimensions(), insets = useSafeAreaInsets();
  const sheet = useRef<ModalBottomSheetRef>(null), choosing = useRef(false);
  if (state.picker === 'closed') return null;
  const ready = state.selection === 'ready' && state.picker === 'ready', error = state.selection === 'error' || state.picker === 'error';
  async function choose(code: string | null) {
    const target = sheet.current;
    if (choosing.current || !target) return;
    choosing.current = true;
    try { await target.hide(); await controller.choose(code); controller.close(); }
    catch { controller.close(); }
    finally { choosing.current = false; }
  }
  return <BaseHost style={{ position: 'absolute', top: 0, bottom: 0, width }}>
    <ModalBottomSheet ref={sheet} onDismissRequest={() => controller.close()} skipPartiallyExpanded showDragHandle>
      <Column modifiers={[height((screenHeight - insets.top) * 0.65), fillMaxWidth(), padding(0, 0, 0, insets.bottom)]}>
        <Text style={{ typography: 'titleLarge' }} modifiers={[padding(16, 0, 16, 12)]}>{p('worker.paddon.active.choose')}</Text>
        {error ? <Box contentAlignment="center" modifiers={[fillMaxSize(), padding(16, 0, 16, 0)]}><Text>{p('worker.paddon.active.load_failed')}</Text></Box>
          : !ready ? <Box contentAlignment="center" modifiers={[fillMaxSize()]}><CircularProgressIndicator /></Box> : <>
            <PaddonChoice code={null} title={p('worker.paddon.active.none')} selected={state.code === null} onChoose={choose} />
            {state.paddons.length ? <LazyColumn modifiers={[weight(1), fillMaxWidth()]}>{state.paddons.map(row => <PaddonChoice key={row.code} code={row.code} title={row.code}
              subtitle={p('worker.paddon.active.rolls', { count: row.item_count })} selected={state.code === row.code} onChoose={choose} />)}</LazyColumn>
              : <Box contentAlignment="center" modifiers={[weight(1), fillMaxWidth(), padding(16, 0, 16, 0)]}><Text>{p('worker.paddon.active.empty')}</Text></Box>}
          </>}
      </Column>
    </ModalBottomSheet>
  </BaseHost>;
}
