import { Box, IconButton, RNHostView, Row, useNativeState, type BasicTextFieldRef } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, height, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { RoleHeaderRow, RoleHeaderSearchField } from '../shared/navigation/RoleHeaderRow';
import { AdminBasicTextField as BasicTextField } from './AdminTextFields.android';
import { AdminText as Text } from './AdminTypography.android';
import type { AdminItemCreateScreenProps } from './AdminItemCreateScreenTypes';
import { ItemCreateIcon } from './AdminItemCreateNative.android';
import { dartTrim } from './dartJsonString';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

function Hint({ visible, label }: { visible: boolean; label: string }) {
  const alpha = useSharedValue(visible ? 1 : 0), { colors } = useBaseTheme();
  useEffect(() => { alpha.value = withTiming(visible ? 1 : 0, { duration: 150, easing: Easing.bezier(0, 0, .58, 1) }); }, [alpha, visible]);
  const motion = useAnimatedStyle(() => ({ opacity: alpha.value }));
  return <RNHostView modifiers={[fillMaxWidth(), height(20)]}><Animated.View pointerEvents="none" accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} style={[styles.hint, motion]}>
    <BaseHost style={styles.hint}><Text style={{ fontSize: 15 }} color={colors.onSurfaceVariant} modifiers={[fillMaxWidth()]}>{label}</Text></BaseHost>
  </Animated.View></RNHostView>;
}
/** @v2 AdminCatalogSearchField */
export function AdminItemCreateHeader({ model, props }: { model: AdminItemCreateScreenModel; props: AdminItemCreateScreenProps }) {
  const { colors } = useBaseTheme(), field = useRef<BasicTextFieldRef>(null), text = useNativeState(model.state.list.searchDraft), { current, owner } = model, searchDraft = model.state.list.searchDraft, generation = model.state.generation;
  const nativeEdits = useRef<{ owner: typeof owner; generation: number } | null>(null);
  useEffect(() => {
    // Compose already owns each user edit, including selection and IME composition.
    // Only the source cache/owner lifetime may fill it; reflecting a published draft
    // can overwrite a newer native edit, even when that draft eventually matches.
    const edited = nativeEdits.current;
    if (edited?.owner === owner && edited.generation === generation) return;
    if (current()) void field.current?.setText(searchDraft);
  }, [searchDraft, current, owner, generation]);
  const change = (value: string) => { if (!model.nativeCurrent()) return; nativeEdits.current = { owner, generation }; model.search(value); };
  const clear = () => { if (!model.nativeCurrent()) return; nativeEdits.current = { owner, generation }; void field.current?.clear(); model.search(''); };
  const close = () => { if (model.nativeCurrent()) { void field.current?.blur(); model.searchFocus(false); } };
  return <RoleHeaderRow>
    {!model.searchFocused && <RoleHeaderButton icon="back" label={props.backLabel} onPress={model.back}
      tintColor={colors.onSurfaceVariant} testID="admin-item-create-back" />}
    <RoleHeaderSearchField focused={model.searchFocused}>
      <BaseHost style={styles.search}><Row verticalAlignment="center" modifiers={[fillMaxSize()]}>
        <BasicTextField ref={field} value={text} singleLine onValueChange={change} onFocusChanged={model.searchFocus} keyboardOptions={{ imeAction: 'search', capitalization: 'none' }} keyboardActions={{ onSearch: close }}
          textStyle={{ color: colors.onSurface, fontSize: 15, textAlign: 'left' }} modifiers={[weight(1), height(56), semantics({ contentDescription: model.a('item.search') }), testID('admin-item-create-search')]}>
          <BasicTextField.DecorationBox><Box contentAlignment="centerStart" modifiers={[fillMaxSize()]}><BasicTextField.InnerTextField />{!dartTrim(searchDraft) ? <Hint visible={!model.searchFocused} label={model.a('item.search')} /> : null}</Box></BasicTextField.DecorationBox>
        </BasicTextField>
        {model.searchFocused || dartTrim(searchDraft) ? <IconButton onClick={model.searchFocused ? close : clear} modifiers={[size(48, 48), semantics({ contentDescription: model.a(model.searchFocused ? 'action.close' : 'action.clear') }), testID('admin-item-search-close')]}><ItemCreateIcon name="close" color={colors.onSurfaceVariant} /></IconButton> : null}
      </Row></BaseHost>
    </RoleHeaderSearchField>
    {model.profileVisible && props.profileAction}
  </RoleHeaderRow>;
}
const styles = StyleSheet.create({
  search: { flex: 1, minWidth: 0, height: 56 },
  hint: { width: '100%', height: 20, justifyContent: 'center' },
});
