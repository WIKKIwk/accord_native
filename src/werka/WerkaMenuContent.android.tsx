import { ScrollView } from 'react-native';
import { PreparationRow } from '../preparation/PreparationUI.android';
import { werkaMenuItems, type WerkaMenuAction, type WerkaMenuKind } from './werkaMenuModel';

/** Reuses existing native preparation rows; shell, dock and routes are supplied by the eventual screen. */
export function WerkaMenuContent({ kind, locale, onSelect }: {
  kind: WerkaMenuKind; locale: string; onSelect: (action: WerkaMenuAction) => void;
}) {
  return <ScrollView contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 4, paddingBottom: 136, gap: 2 }}>
    {werkaMenuItems(kind, locale).map(item => <PreparationRow key={item.id} title={item.title} subtitle={item.subtitle}
      onPress={() => onSelect(item.id)} />)}
  </ScrollView>;
}
