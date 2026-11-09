import { Box, Column, Host, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxSize, fillMaxWidth, paddingAll, semantics, Shapes, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extensionText, localizedMethod } from '../shared/localization';
import { qolipProductPassivePresentation } from './qolipProductPassivePresentation';
import type { QolipProductPassiveContentProps } from './qolipProductPassiveContentProps';
import { useQolipPassiveBoundary } from './useQolipPassiveBoundary';
import { useQolipText } from './useQolipText';

// Unmounted display only. No image fetch, expand/selection, clipboard, retry or mutation is connected.
export function QolipProductPassiveContent({ boundary, rows, reworkCodes }: QolipProductPassiveContentProps) {
  const lifetime = useQolipPassiveBoundary(boundary), { locale, text } = useQolipText(), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const shared = (key: string) => extensionText('qolipSharedSetText', key, locale);
  const rework = (key: string, values: Record<string, unknown> = {}) => extensionText('qolipReworkText', key, locale, values);
  if (!lifetime.valid || !lifetime.isCurrent()) return null;
  const content = rows.map((row, index) => {
    const view = qolipProductPassivePresentation(row.container, reworkCodes);
    return <Host key={`${row.container.catalogId ?? row.container.code}:${index}`} matchContents={{ vertical: true }}>
      <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(12)), background(colors.surface), paddingAll(10)]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
          <Column modifiers={[weight(1)]}><Text maxLines={2} overflow="ellipsis" style={{ typography: 'titleMedium', fontWeight: '700' }}>{view.title}</Text>
            {view.hasDetails && <Text>{text(view.inUse ? 'products.count_in_use' : 'products.mold_count', { count: view.count })}</Text>}
            {view.hasDetails && view.reworkCount > 0 && <Text color={colors.error}>{rework('in_rework_count', { count: view.reworkCount })}</Text>}
          </Column>{row.loading && <RNHostView matchContents><ActivityIndicator /></RNHostView>}</Row>
        {row.expanded && (row.errorMessage !== null ? <Text>{row.errorMessage}</Text> : row.loading ? <RNHostView matchContents><ActivityIndicator /></RNHostView> :
          <Column verticalArrangement={{ spacedBy: 8 }}>{view.sections.map((section, sectionIndex) => <Column key={`${section.id}:${sectionIndex}`} verticalArrangement={{ spacedBy: 6 }}>
            <Text>{section.extension ? shared('extensions') : `${shared('id')}: ${section.id}`}</Text>
            {section.alternativeIndex !== null && <Text>{`${text('products.alternative_set')} ${section.alternativeIndex}`}</Text>}
            {section.members.map(({ product, inRework, color, subtitle }, memberIndex) => {
              const label = color ? text('products.color_label', { color: localizedMethod('qolipColorName', locale, { raw: product.color }) }) : '';
              const subtitleText = subtitle === 'rework' ? rework('open') : subtitle === 'issued' ? text('products.issued')
                : subtitle === 'size' ? text('products.size_value', { size: product.size }) : '';
              return <Row key={`${product.qolip_code}:${memberIndex}`} horizontalArrangement={{ spacedBy: 8 }}>
                <RNHostView matchContents><SymbolView name={{ android: inRework ? 'build' : product.is_in_use ? 'lock_outline' : 'qr_code_2' }}
                  size={17} tintColor={colors.onSurfaceVariant} /></RNHostView>
                {color && <Box modifiers={[size(16, 16), clip(Shapes.Circle), background(colors.outlineVariant), paddingAll(1), semantics({ contentDescription: label })]}>
                  <Box modifiers={[fillMaxSize(), clip(Shapes.Circle), background(color)]} />
                </Box>}<Column><Text maxLines={1} overflow="ellipsis" style={{ fontWeight: '700' }}>{product.qolip_code}</Text>
                  {!!subtitleText && <Text>{subtitleText}</Text>}</Column>
              </Row>;
            })}
          </Column>)}</Column>)}
      </Column>
    </Host>;
  });
  if (!lifetime.isCurrent()) return null;
  return <ScrollView contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: insets.bottom + 112 }}>{content}</ScrollView>;
}
