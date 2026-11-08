import { Box, Column, Host, IconButton, OutlinedTextField, RNHostView, Row, Text, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { background, clickable, clip, fillMaxSize, fillMaxWidth, paddingAll, semantics, Shapes, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extensionText, localizedGetter, localizedMethod } from '../shared/localization';
import { trimDart } from './qolipApiCommon';
import { qolipVisibleColor } from './qolipColorPresentation';
import type { QolipSetsReadContentProps } from './qolipSetsReadContentProps';
import { useQolipText } from './useQolipText';

// Unmounted partial content. Clipboard and all mutations/retry/refresh are absent.
export function QolipSetsReadContent({ snapshot }: QolipSetsReadContentProps) {
  const input = useNativeState(snapshot.search), { locale, text } = useQolipText(), colors = useMaterialColors(), insets = useSafeAreaInsets();
  if (snapshot.invalid || !snapshot.actions) return null;
  const actions = snapshot.actions, management = (key: string, values: Record<string, unknown> = {}) =>
    extensionText('qolipManagementText', key, locale, values);
  return <View style={{ flex: 1 }}>
    <Host matchContents={{ vertical: true }}><OutlinedTextField value={input} singleLine onValueChange={actions.setSearch}
      modifiers={[fillMaxWidth(), testID('qolip-sets-search')]}>
      <OutlinedTextField.Placeholder><Text>{management('search')}</Text></OutlinedTextField.Placeholder>
      <OutlinedTextField.LeadingIcon><RNHostView matchContents><SymbolView name={{ android: 'search' }} size={20} tintColor={colors.onSurfaceVariant} /></RNHostView></OutlinedTextField.LeadingIcon>
      {snapshot.search !== '' && <OutlinedTextField.TrailingIcon><IconButton onClick={() => { input.set(''); actions.setSearch(''); }}
        modifiers={[semantics({ contentDescription: localizedGetter('clearTitle', locale) })]}><RNHostView matchContents>
          <SymbolView name={{ android: 'close' }} size={20} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton></OutlinedTextField.TrailingIcon>}
    </OutlinedTextField></Host>
    {snapshot.loading ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
      : snapshot.error ? <Host style={{ flex: 1 }}><Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text></Host>
        : snapshot.rows.length === 0 ? <Host style={{ flex: 1 }}><Text>{management('empty')}</Text></Host>
          : <ScrollView contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: insets.bottom + 112 }}>
            {snapshot.rows.map((row, index) => {
              const entry = row.entry, expanded = row.expanded;
              const subtitle = [entry.name ? entry.set.id : '', text('products.mold_count', { count: entry.set.members.length })].filter(Boolean).join(' · ');
              return <Host key={`${entry.set.id}:${index}`} matchContents={{ vertical: true }}><Column verticalArrangement={{ spacedBy: 10 }}
                modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(12)), background(colors.surface), paddingAll(10)]}>
                <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(), testID(`qolip-set-row-${index}`),
                  ...(snapshot.saving ? [] : [clickable(() => actions.tap(entry, expanded))])]}>
                  <RNHostView matchContents><SymbolView name={{ android: 'layers' }} size={22} tintColor={colors.onSurfaceVariant} /></RNHostView>
                  <Column modifiers={[weight(1)]}><Text maxLines={2} overflow="ellipsis" style={{ typography: 'titleMedium', fontWeight: '700' }}>{entry.display_name}</Text>
                    <Text>{subtitle}</Text></Column>
                  <RNHostView matchContents><SymbolView name={{ android: expanded ? 'expand_less' : 'expand_more' }} size={22} tintColor={colors.onSurfaceVariant} /></RNHostView>
                </Row>{expanded && <Column verticalArrangement={{ spacedBy: 8 }}>
                  <Text>{management('linked', { count: entry.set.product_labels.length })}</Text>
                  {entry.set.product_labels.length > 0 && <Text>{entry.set.product_labels.join(', ')}</Text>}
                  {entry.set.members.map((member, memberIndex) => {
                    const subtitle = member.is_in_use ? text('products.issued') : member.size > 0 ? text('products.size_value', { size: member.size }) : '';
                    const color = qolipVisibleColor(member.color), colorLabel = color
                    ? text('products.color_label', { color: localizedMethod('qolipColorName', locale, { raw: member.color }) }) : '';
                    return <Row key={`${member.qolip_code}:${memberIndex}`} horizontalArrangement={{ spacedBy: 8 }}>
                      <RNHostView matchContents><SymbolView name={{ android: member.is_in_use ? 'lock_outline' : 'qr_code_2' }} size={17} tintColor={colors.onSurfaceVariant} /></RNHostView>
                      {color && <Box modifiers={[size(16, 16), clip(Shapes.Circle), background(colors.outlineVariant), paddingAll(1), semantics({ contentDescription: colorLabel })]}>
                        <Box modifiers={[fillMaxSize(), clip(Shapes.Circle), background(color)]} />
                      </Box>}<Column><Text maxLines={1} overflow="ellipsis" style={{ fontWeight: '700' }}>{member.qolip_code}</Text>
                        {!!trimDart(subtitle) && <Text>{subtitle}</Text>}</Column>
                    </Row>;
                  })}
                </Column>}
              </Column></Host>;
            })}
          </ScrollView>}
  </View>;
}
