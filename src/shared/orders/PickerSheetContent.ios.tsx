import { Button, Host, HStack, RNHostView, Image, ProgressView, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityLabel, background, buttonStyle, cornerRadius, disabled, font, frame, labelStyle, listRowBackground,
  listRowSeparator, onAppear, padding } from '@expo/ui/swift-ui/modifiers';
import { useEffect,type ReactElement } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useBaseTheme } from '../../components/useBaseTheme';
import { OrdersList } from './OrdersList';

type PickerItem = { key: string; title: string; subtitle?: string; select: () => void };
type Props = {
  title: string; hint: string; closeLabel: string; emptyLabel: string;
  items: readonly PickerItem[]; onClose: () => void; onSearch: (query: string) => void;
  query?: string; loading?: boolean; error?: string; retryLabel?: string; onRetry?: () => void;
  hasMore?: boolean; onLoadMore?: () => void; photoLabel?: string; onPhoto?: () => void;
  photoLoading?: boolean; photoError?: string;autoFocus?:boolean;headerAction?:ReactElement;
};

export function PickerSheetContent({ title, hint, closeLabel, emptyLabel, items, onClose, onSearch,
  query, loading = false, error, retryLabel, onRetry, hasMore = false, onLoadMore,
  photoLabel, onPhoto, photoLoading = false, photoError,autoFocus=false,headerAction }: Props) {
  const { colors } = useBaseTheme(), input = useNativeState(query ?? '');
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  useEffect(() => { if (query !== undefined && input.get() !== query) input.set(query); }, [input, query]);
  const loadMore = () => {
    if (hasMore && !loading) onLoadMore?.();
  };
  return <Host style={{ flex: 1 }}><VStack alignment="leading" spacing={12} modifiers={[padding({ horizontal: 12, top: 6 })]}>
    <HStack><Text modifiers={[font({ textStyle: 'title2' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{title}</Text>
      {headerAction?<RNHostView matchContents>{headerAction}</RNHostView>:null}<Button label={closeLabel} systemImage="xmark" onPress={onClose}
        modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), accessibilityLabel(closeLabel)]} />
    </HStack>
    <HStack spacing={10} modifiers={[padding({ horizontal: 16, vertical: 12 }), background(colors.surfaceContainerHighest), cornerRadius(30)]}>
      <Image systemName="magnifyingglass" size={20} />
      <TextField autoFocus={autoFocus} text={input} placeholder={hint} onTextChange={onSearch} modifiers={[frame({ maxWidth: Infinity })]} />
      {onPhoto && <Button label={photoLabel} systemImage="qrcode.viewfinder" onPress={onPhoto}
        modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), disabled(photoLoading), accessibilityLabel(photoLabel ?? '')]} />}
    </HStack>
    {photoLoading ? <ProgressView /> : null}{photoError ? <Text>{photoError}</Text> : null}
    <OrdersList<PickerItem> active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0}
      rows={items} rowKey={item => item.key} renderRow={(item, index) => <Button onPress={item.select} modifiers={[
        buttonStyle('plain'), listRowBackground(colors.surfaceContainerHighest), listRowSeparator('hidden'),
        ...(index === items.length - 1 && hasMore ? [onAppear(loadMore)] : []),
      ]}><VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ vertical: 8 })]}>
        <Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{item.title}</Text>
        {item.subtitle ? <Text modifiers={[font({ textStyle: 'caption' })]}>{item.subtitle}</Text> : null}
      </VStack></Button>}
      footer={<>
      {loading ? <ProgressView /> : null}
      {error ? <VStack><Text>{error}</Text>{onRetry && retryLabel ? <Button label={retryLabel} onPress={onRetry} /> : null}</VStack> : null}
      </>}>
      {!loading && !error && !items.length ? <Text>{emptyLabel}</Text> : null}
    </OrdersList>
  </VStack></Host>;
}
