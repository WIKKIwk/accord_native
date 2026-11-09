import { Button, Section, Text, VStack } from '@expo/ui/swift-ui';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { werkaMenuItems, type WerkaMenuAction, type WerkaMenuKind } from './werkaMenuModel';

/** Reuses the existing native preparation list; shell, dock and routes are supplied by the eventual screen. */
export function WerkaMenuContent({ kind, locale, onSelect }: {
  kind: WerkaMenuKind; locale: string; onSelect: (action: WerkaMenuAction) => void;
}) {
  const items = werkaMenuItems(kind, locale);
  return <PreparationList><Section>{items.map(item => <Button key={item.id} onPress={() => onSelect(item.id)}>
    <VStack alignment="leading" spacing={4}><Text>{item.title}</Text>{item.subtitle ? <Text>{item.subtitle}</Text> : null}</VStack>
  </Button>)}</Section></PreparationList>;
}
