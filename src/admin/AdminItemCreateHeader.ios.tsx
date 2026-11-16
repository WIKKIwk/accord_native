import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { PlatformColor } from 'react-native';
import type { SearchBarCommands } from 'react-native-screens';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import type { AdminItemCreateScreenProps } from './AdminItemCreateScreenTypes';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

/** iOS uses the actual native search controller. Cancel closes focus and preserves Source query text. */
export function AdminItemCreateHeader({ model, props }: { model: AdminItemCreateScreenModel; props: AdminItemCreateScreenProps }) {
  const search = useRef<SearchBarCommands>(null), owner = model.owner, generation = model.state.generation, draft = model.state.list.searchDraft, { current } = model;
  const canceled = useRef<{ owner: typeof owner; generation: number; text: string } | null>(null), typed = useRef<{ owner: typeof owner; generation: number; text: string } | null>(null);
  // UIKit already owns each native edit. Even an equal-text assignment is an
  // unnecessary imperative edit during selection/IME composition; only cache
  // restoration for a fresh owner/generation may fill this native controller.
  useEffect(() => { const value = typed.current; if (value?.owner === owner && value.generation === generation) return; if (current()) search.current?.setText(draft); }, [current, owner, generation, draft]);
  const close = () => { if (!model.nativeCurrent()) return; const value = typed.current, text = value?.owner === owner && value.generation === generation ? value.text : draft;
    canceled.current = { owner, generation, text }; model.searchFocus(false); search.current?.setText(text);
  };
  const change = (text: string) => { const cancel = canceled.current; canceled.current = null;
    if (cancel && text === '') { if (cancel.owner === owner && cancel.generation === generation && model.nativeCurrent()) search.current?.setText(cancel.text); return; }
    if (model.nativeCurrent()) typed.current = { owner, generation, text }; model.search(text);
  };
  return <Stack.Screen options={{ title: '', headerShown: true, headerLargeTitle: false, headerShadowVisible: false, headerBackVisible: false,
    headerLeft: model.searchFocused ? undefined : () => <RoleHeaderButton icon="back" label={props.backLabel} onPress={model.back} tintColor={PlatformColor('label')} />,
    headerRight: model.profileVisible ? () => props.profileAction : undefined,
    headerSearchBarOptions: { ref: search, placeholder: model.a('item.search'), hideWhenScrolling: false, hideNavigationBar: false, obscureBackground: false,
      autoCapitalize: 'none', cancelButtonText: model.a('action.close'), onChangeText: event => change(event.nativeEvent.text), onFocus: () => model.searchFocus(true), onBlur: () => model.searchFocus(false), onCancelButtonPress: close,
      onSearchButtonPress: () => { if (model.nativeCurrent()) { search.current?.blur(); model.searchFocus(false); } } } }} />;
}
