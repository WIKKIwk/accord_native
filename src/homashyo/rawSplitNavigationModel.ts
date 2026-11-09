import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import type { RoleDrawerItem } from '../shared/navigation/roleDrawerModel';

export type RawSplitPage = 'home' | 'history' | 'profile';
type Translate = (text: string) => string;
export type RawSplitDockItem = { id: 'home' | 'profile'; label: string; android: AndroidSymbol;
  ios: { default: SFSymbol; selected: SFSymbol } };

/** @v2 RawMaterialSplitDrawer */
export function rawSplitDrawerItems(t: Translate): RoleDrawerItem[] {
  return [
    { id: 'home', label: t('Rezka'), symbol: { ios: 'scissors', android: 'content_cut' } },
    { id: 'history', label: t('Rezka tarixi'), symbol: { ios: 'clock.arrow.circlepath', android: 'history' } },
    { id: 'profile', label: t('Profil'), symbol: { ios: 'person', android: 'person_outline' } },
  ];
}

/** V2 role destinations before the shared dock appends Chat. */
export function rawSplitNonChatDockItems(t: Translate): RawSplitDockItem[] {
  return [
    { id: 'home', label: t('Rezka'), android: 'content_cut', ios: { default: 'scissors', selected: 'scissors' } },
    { id: 'profile', label: t('Profil'), android: 'person', ios: { default: 'person', selected: 'person.fill' } },
  ];
}

export const rawSplitDrawerActive = (page: RawSplitPage): RawSplitPage => page;
/** History uses the home dock destination in V2. */
export const rawSplitDockActive = (page: RawSplitPage): 'home' | 'profile' => page === 'profile' ? 'profile' : 'home';

/** Source-derived header state for the role home/history screens. */
export function rawSplitHeader(page: 'home' | 'history', busy: boolean, t: Translate) {
  return {
    title: t(page === 'home' ? 'Rezka' : 'Rezka tarixi'), navigation: page === 'home' ? 'drawer' : 'back',
    showHistory: page === 'home', historyEnabled: page === 'home' && !busy,
    printerEnabled: !busy, loading: busy,
  } as const;
}

/** V2 pops the history screen when possible; otherwise it replaces the root with the home page. */
export const rawSplitHistoryBackAction = (canPop: boolean): 'pop' | 'home-replacement' => canPop ? 'pop' : 'home-replacement';
