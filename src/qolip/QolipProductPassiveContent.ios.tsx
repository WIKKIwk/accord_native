import { Circle, Host, HStack, Image, ProgressView, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, background, font, foregroundStyle, frame, lineLimit, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extensionText, localizedMethod } from '../shared/localization';
import { qolipProductPassivePresentation } from './qolipProductPassivePresentation';
import type { QolipProductPassiveContentProps } from './qolipProductPassiveContentProps';
import { useQolipPassiveBoundary } from './useQolipPassiveBoundary';
import { useQolipText } from './useQolipText';

// Unmounted display only. No image fetch, expand/selection, clipboard, retry or mutation is connected.
export function QolipProductPassiveContent({ boundary, rows, reworkCodes }: QolipProductPassiveContentProps) {
  const lifetime = useQolipPassiveBoundary(boundary), { locale, text } = useQolipText(), insets = useSafeAreaInsets();
  const shared = (key: string) => extensionText('qolipSharedSetText', key, locale);
  const rework = (key: string, values: Record<string, unknown> = {}) => extensionText('qolipReworkText', key, locale, values);
  if (!lifetime.valid || !lifetime.isCurrent()) return null;
  const content = rows.map((row, index) => {
    const view = qolipProductPassivePresentation(row.container, reworkCodes);
    return <Host key={`${row.container.catalogId ?? row.container.code}:${index}`} matchContents={{ vertical: true }}>
      <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 14, vertical: 10 }),
        background(PlatformColor('systemBackground'), shapes.roundedRectangle({ cornerRadius: 12 }))]}>
        <HStack spacing={8}><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ weight: 'bold' }), lineLimit(2)]}>{view.title}</Text>
          {view.hasDetails && <Text>{text(view.inUse ? 'products.count_in_use' : 'products.mold_count', { count: view.count })}</Text>}
          {view.hasDetails && view.reworkCount > 0 && <Text>{rework('in_rework_count', { count: view.reworkCount })}</Text>}
        </VStack>{row.loading && <ProgressView />}</HStack>
        {row.expanded && (row.errorMessage !== null ? <Text>{row.errorMessage}</Text> : row.loading ? <ProgressView /> :
          <VStack alignment="leading" spacing={8}>{view.sections.map((section, sectionIndex) => <VStack key={`${section.id}:${sectionIndex}`} alignment="leading" spacing={6}>
            <Text>{section.extension ? shared('extensions') : `${shared('id')}: ${section.id}`}</Text>
            {section.alternativeIndex !== null && <Text>{`${text('products.alternative_set')} ${section.alternativeIndex}`}</Text>}
            {section.members.map(({ product, inRework, color, subtitle }, memberIndex) => {
              const label = color ? text('products.color_label', { color: localizedMethod('qolipColorName', locale, { raw: product.color }) }) : '';
              const subtitleText = subtitle === 'rework' ? rework('open') : subtitle === 'issued' ? text('products.issued')
                : subtitle === 'size' ? text('products.size_value', { size: product.size }) : '';
              return <HStack key={`${product.qolip_code}:${memberIndex}`} spacing={8}>
                <Image systemName={inRework ? 'wrench' : product.is_in_use ? 'lock' : 'qrcode'} />
                {color && <ZStack modifiers={[accessibilityLabel(label)]}>
                  <Circle modifiers={[frame({ width: 16, height: 16 }), foregroundStyle(PlatformColor('separator'))]} />
                  <Circle modifiers={[frame({ width: 14, height: 14 }), foregroundStyle(color)]} />
                </ZStack>}<VStack alignment="leading" spacing={2}><Text modifiers={[font({ weight: 'bold' }), lineLimit(1)]}>{product.qolip_code}</Text>
                  {!!subtitleText && <Text>{subtitleText}</Text>}</VStack>
              </HStack>;
            })}
          </VStack>)}</VStack>)}
      </VStack>
    </Host>;
  });
  if (!lifetime.isCurrent()) return null;
  return <ScrollView contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: insets.bottom + 112 }}>{content}</ScrollView>;
}
