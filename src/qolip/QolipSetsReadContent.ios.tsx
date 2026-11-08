import { Button, Host, HStack, Image, ProgressView, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, contentShape, disabled, font, frame, labelStyle, lineLimit,
  onTapGesture, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extensionText, localizedGetter } from '../shared/localization';
import { trimDart } from './qolipApiCommon';
import type { QolipSetsReadContentProps } from './qolipSetsReadContentProps';
import { useQolipText } from './useQolipText';

// Unmounted partial content. Color swatches, clipboard and all mutations/retry/refresh are absent.
export function QolipSetsReadContent({ snapshot }: QolipSetsReadContentProps) {
  const input = useNativeState(snapshot.search), { locale, text } = useQolipText(), insets = useSafeAreaInsets();
  if (snapshot.invalid || !snapshot.actions) return null;
  const actions = snapshot.actions, management = (key: string, values: Record<string, unknown> = {}) =>
    extensionText('qolipManagementText', key, locale, values);
  return <View style={{ flex: 1 }}>
    <Host matchContents={{ vertical: true }}><HStack spacing={8}>
      <Image systemName="magnifyingglass" /><TextField text={input} placeholder={management('search')}
        onTextChange={actions.setSearch} modifiers={[frame({ maxWidth: Infinity })]} />
      {snapshot.search !== '' && <Button label={localizedGetter('clearTitle', locale)} systemImage="xmark.circle.fill"
        onPress={() => { input.set(''); actions.setSearch(''); }} modifiers={[labelStyle('iconOnly'), accessibilityLabel(localizedGetter('clearTitle', locale))]} />}
    </HStack></Host>
    {snapshot.loading ? <Host style={{ flex: 1 }}><ProgressView /></Host>
      : snapshot.error ? <Host style={{ flex: 1 }}><Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text></Host>
        : snapshot.rows.length === 0 ? <Host style={{ flex: 1 }}><Text>{management('empty')}</Text></Host>
          : <ScrollView contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: insets.bottom + 112 }}>
            {snapshot.rows.map((row, index) => {
              const entry = row.entry, expanded = row.expanded;
              const subtitle = [entry.name ? entry.set.id : '', text('products.mold_count', { count: entry.set.members.length })].filter(Boolean).join(' · ');
              return <Host key={`${entry.set.id}:${index}`} matchContents={{ vertical: true }}><VStack alignment="leading" spacing={10} modifiers={[
                frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 14, vertical: 10 }),
                background(PlatformColor('systemBackground'), shapes.roundedRectangle({ cornerRadius: 12 })),
              ]}><HStack spacing={10} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), contentShape(shapes.rectangle()),
                accessibilityIdentifier(`qolip-set-row-${index}`), disabled(snapshot.saving), onTapGesture(() => actions.tap(entry, expanded))]}>
                <Image systemName="square.stack.3d.up" /><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                  <Text modifiers={[font({ weight: 'bold' }), lineLimit(2)]}>{entry.display_name}</Text><Text>{subtitle}</Text>
                </VStack><Image systemName={expanded ? 'chevron.up' : 'chevron.down'} />
              </HStack>{expanded && <VStack alignment="leading" spacing={8}>
                <Text>{management('linked', { count: entry.set.product_labels.length })}</Text>
                {entry.set.product_labels.length > 0 && <Text>{entry.set.product_labels.join(', ')}</Text>}
                {entry.set.members.map((member, memberIndex) => {
                  const subtitle = member.is_in_use ? text('products.issued') : member.size > 0 ? text('products.size_value', { size: member.size }) : '';
                  return <HStack key={`${member.qolip_code}:${memberIndex}`} spacing={8}>
                    <Image systemName={member.is_in_use ? 'lock' : 'qrcode'} /><VStack alignment="leading" spacing={2}>
                      <Text modifiers={[font({ weight: 'bold' }), lineLimit(1)]}>{member.qolip_code}</Text>
                      {!!trimDart(subtitle) && <Text>{subtitle}</Text>}
                    </VStack>
                  </HStack>;
                })}
              </VStack>}</VStack></Host>;
            })}
          </ScrollView>}
  </View>;
}
