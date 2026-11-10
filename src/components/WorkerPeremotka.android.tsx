import { Box, CircularProgressIndicator, Column, IconButton, LazyColumn, ListItem, ModalBottomSheet, RNHostView, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, height, padding, semantics, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from './BaseHost';
import type { useWorkerPeremotka } from './useWorkerPeremotka';
type Props = ReturnType<typeof useWorkerPeremotka>;

export function WorkerPeremotkaButton({ title, controller, disabled, onOpen }: Props & { disabled?: boolean; onOpen?: () => void }) {
  const colors = useMaterialColors();
  return <BaseHost matchContents style={{ width: 44, height: 48 }}><IconButton enabled={!disabled} onClick={onOpen ?? (() => { void controller.open(); })} modifiers={[size(44, 48), semantics({ contentDescription: title })]}>
    <RNHostView matchContents><SymbolView name={{ android: 'replay' }} size={22} tintColor={colors.onSurfaceVariant} /></RNHostView>
  </IconButton></BaseHost>;
}

export function WorkerPeremotkaSheet({ state, controller, rows, title, error, empty }: Props) {
  const { width, height: screenHeight } = useWindowDimensions(), insets = useSafeAreaInsets();
  if (state.phase === 'closed') return null;
  return <BaseHost style={{ position: 'absolute', top: 0, bottom: 0, width }}>
    <ModalBottomSheet onDismissRequest={() => controller.close()} skipPartiallyExpanded showDragHandle>
      <Column modifiers={[height((screenHeight - insets.top) * 0.56), fillMaxWidth(), padding(0, 0, 0, insets.bottom)]}>
        <Text style={{ typography: 'titleLarge' }} modifiers={[padding(16, 0, 16, 12)]}>{title}</Text>
        {state.phase === 'loading' ? <Box contentAlignment="center" modifiers={[fillMaxSize()]}><CircularProgressIndicator /></Box>
          : state.phase === 'error' || !rows.length ? <Box contentAlignment="center" modifiers={[fillMaxSize(), padding(16, 0, 16, 0)]}><Text>{state.phase === 'error' ? error : empty}</Text></Box>
            : <LazyColumn modifiers={[fillMaxWidth(), weight(1)]}>{rows.map(row => <ListItem key={row.id}>
              <ListItem.HeadlineContent><Text>{row.title}</Text></ListItem.HeadlineContent>
              <ListItem.SupportingContent><Text>{row.subtitle}</Text></ListItem.SupportingContent>
            </ListItem>)}</LazyColumn>}
      </Column>
    </ModalBottomSheet>
  </BaseHost>;
}
