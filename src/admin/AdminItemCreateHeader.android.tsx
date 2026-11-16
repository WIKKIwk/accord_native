import { Box, IconButton, RNHostView, Row, Spacer, Surface, useNativeState, type BasicTextFieldRef } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminBasicTextField as BasicTextField } from './AdminTextFields.android';
import { AdminText as Text } from './AdminTypography.android';
import type { AdminItemCreateScreenProps } from './AdminItemCreateScreenTypes';
import { ItemCreateIcon, itemCreateRounded } from './AdminItemCreateNative.android';
import { dartTrim } from './dartJsonString';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

const blend = (foreground: string, background: string) => `#${[1, 3, 5].map(offset => Math.round(parseInt(foreground.slice(offset, offset + 2), 16) * .08 + parseInt(background.slice(offset, offset + 2), 16) * .92).toString(16).padStart(2, '0')).join('')}FF`;
function Slot({ visible, slotWidth, children }: { visible: boolean; slotWidth: number; children: ReactNode }) {
  const width = useSharedValue(visible ? slotWidth : 0), alpha = useSharedValue(visible ? 1 : 0);
  useEffect(() => { width.value = withTiming(visible ? slotWidth : 0, { duration: 180, easing: Easing.bezier(0, 0, .58, 1) }); alpha.value = withTiming(visible ? 1 : 0, { duration: 120, easing: Easing.linear }); }, [visible, slotWidth, width, alpha]);
  const motion = useAnimatedStyle(() => ({ width: width.value, opacity: alpha.value }));
  return <Animated.View style={[styles.slot, motion]} pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}><View style={{ width: slotWidth, height: 60, justifyContent: 'center' }}>{children}</View></Animated.View>;
}
function Hint({ visible, label }: { visible: boolean; label: string }) {
  const alpha = useSharedValue(visible ? 1 : 0), { colors } = useBaseTheme();
  useEffect(() => { alpha.value = withTiming(visible ? 1 : 0, { duration: 150, easing: Easing.bezier(0, 0, .58, 1) }); }, [alpha, visible]);
  const motion = useAnimatedStyle(() => ({ opacity: alpha.value }));
  return <RNHostView modifiers={[fillMaxWidth(), height(20)]}><Animated.View pointerEvents="none" accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} style={[styles.hint, motion]}>
    <BaseHost style={styles.hint}><Text style={{ fontSize: 14, fontWeight: '400', lineHeight: 16.8, textAlign: 'center' }} color={colors.onSurfaceVariant} modifiers={[fillMaxWidth()]}>{label}</Text></BaseHost>
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
  return <View style={styles.header}><Slot visible={!model.searchFocused} slotWidth={44}><BaseHost matchContents><IconButton onClick={model.back} modifiers={[size(38, 48), semantics({ contentDescription: props.backLabel }), testID('admin-item-create-back')]}><ItemCreateIcon name="arrow_back" color={colors.onSurfaceVariant} /></IconButton></BaseHost></Slot>
    <BaseHost style={styles.search}><Surface color={blend(colors.outlineVariant, colors.surfaceContainerLow)} shape={itemCreateRounded(999)} modifiers={[fillMaxWidth(), height(58)]}><Row verticalAlignment="center" modifiers={[fillMaxSize(), padding(18, 0, 0, 0)]}>
      <BasicTextField ref={field} value={text} singleLine onValueChange={change} onFocusChanged={model.searchFocus} keyboardOptions={{ imeAction: 'search', capitalization: 'none' }} keyboardActions={{ onSearch: close }}
        textStyle={{ color: colors.onSurfaceVariant, fontSize: 14, fontWeight: '400', lineHeight: 16.8 }} modifiers={[weight(1), height(58), semantics({ contentDescription: model.a('item.search') }), testID('admin-item-create-search')]}>
        <BasicTextField.DecorationBox><Box contentAlignment="centerStart" modifiers={[fillMaxSize()]}><BasicTextField.InnerTextField />{!dartTrim(searchDraft) ? <Hint visible={!model.searchFocused} label={model.a('item.search')} /> : null}</Box></BasicTextField.DecorationBox>
      </BasicTextField>
      {model.searchFocused || dartTrim(searchDraft) ? <IconButton onClick={model.searchFocused ? close : clear} modifiers={[size(48, 48), semantics({ contentDescription: model.a(model.searchFocused ? 'action.close' : 'action.clear') }), testID('admin-item-search-close')]}><ItemCreateIcon name="close" color={colors.onSurfaceVariant} /></IconButton> : <Spacer modifiers={[size(18, 1)]} />}
    </Row></Surface></BaseHost><Slot visible={model.profileVisible} slotWidth={58}>{props.profileAction}</Slot>
  </View>;
}
const styles = StyleSheet.create({ header: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }, slot: { overflow: 'hidden', height: 60 }, search: { flex: 1, height: 58, transform: [{ translateY: -1 }] }, hint: { width: '100%', height: 20, justifyContent: 'center' } });
