/* global __dirname */
const path = require('node:path');
const s = require('./adminItemCreateNativeSupport.cjs');
const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
function fixture() {
  const f = s.catalogModel(); let valid = true, focused = true; f.model.state.generation = 1; f.model.searchFocused = false; f.model.profileVisible = true;
  f.model.current = () => valid; f.model.nativeCurrent = () => valid && focused; f.model.owner.controller.getSnapshot = () => f.model.state;
  f.model.owner.controller.openDialog = () => f.calls.push('dialog'); f.model.back = () => f.calls.push('back'); f.model.requestMove = () => f.calls.push('move');
  f.model.owner.controller.list = { requestMove: () => f.calls.push('move') };
  f.model.search = value => f.calls.push(['search', value]); f.model.searchFocus = value => f.calls.push(['focus', value]);
  return { ...f, valid: value => { valid = value; }, focus: value => { focused = value; } };
}
function view(kind, platform, f = fixture(), r = s.runtime()) {
  const native = new Map(), commands = [], root = [], motions = [], buffer = { text: null, selection: 0, composing: null }; let fieldProps;
  const component = name => Object.assign(props => {
    if (name === 'BasicTextField' && props.ref) {
      fieldProps = props; if (buffer.text === null) { buffer.text = props.value.value; buffer.selection = buffer.text.length; }
      props.ref.current = { setText: value => { commands.push(['set', value]); buffer.text = value; buffer.selection = value.length; buffer.composing = null; props.value.set(value); },
        clear: () => { commands.push('clear'); buffer.text = ''; buffer.selection = 0; buffer.composing = null; props.value.set(''); }, blur: () => commands.push('blur') };
    }
    return { type: name, props };
  }, { DecorationBox: 'DecorationBox', InnerTextField: 'InnerTextField', Placeholder: 'Placeholder' });
  const useNativeState = initial => { const ref = r.react.useRef(null); return ref.current ??= { value: initial, set(value) { this.value = value; } }; };
  const compose = new Proxy({ useNativeState }, { get: (target, name) => target[name] ?? (native.get(name) || native.set(name, component(String(name))).get(name)) });
  const primaryHook = s.load('admin/useAdminItemCreatePrimaryAction', { react: r.react, './AdminSourceSceneScaffoldContext': { useAdminSourceSceneScaffold: () => null } });
  const props = { backLabel: 'Back', profileAction: { type: 'ActualProfileAction', props: {} }, renderPrimaryAction: value => { root.push(value); return { type: 'RootPrimaryAction', props: value }; } };
  const mocks = { react: r.react, '@expo/ui/jetpack-compose': compose, '@expo/ui/swift-ui': compose, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui/modifiers': modifiers,
    './AdminSourceSceneScaffoldContext': { useAdminSourceSceneScaffold: () => null }, './useAdminSourceScenePrimary': { useAdminSourceScenePrimary() { throw Error('Legacy must not register a Source primary'); } },
    './useAdminItemCreatePrimaryAction': primaryHook, './AdminTextFields.android': { AdminBasicTextField: component('BasicTextField') }, './AdminTypography.android': { AdminText: 'Text' }, './AdminItemCreateNative.android': { ItemCreateIcon: 'Icon', itemCreateRounded: radius => ({ radius }) },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors: s.colors, mode: 'light' }) },
    'react-native': { View: 'View', PlatformColor: value => value, StyleSheet: { create: value => value, absoluteFill: { position: 'absolute' } } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, Easing: { linear: 'linear', bezier: (...args) => args }, useSharedValue: initial => r.react.useRef({ value: initial }).current, useAnimatedStyle: fn => fn(), withTiming: (value, options) => { motions.push(options); return value; } },
    'expo-router': { Stack: { Screen: value => { const options = value.options.headerSearchBarOptions, ref = options?.ref; if (ref) { fieldProps = options; ref.current = { setText: text => { commands.push(['set', text]); buffer.text = text; buffer.selection = text.length; buffer.composing = null; }, blur: () => commands.push('blur') }; } return { type: 'Stack.Screen', props: value }; } } },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'BackButton' }, './dartJsonString': s.strings };
  const module = s.compile(path.resolve(__dirname, `../src/admin/AdminItemCreate${kind}.${platform}.tsx`), mocks);
  const input = (value, options = {}, tree) => { const field = tree ? platform === 'android' ? s.nativeId(tree, 'admin-item-create-search').props : s.nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerSearchBarOptions : fieldProps;
    buffer.text = value; buffer.selection = options.selection ?? value.length; buffer.composing = options.composing ?? null;
    if (platform === 'android') { field.value.set(value); field.onValueChange(value); } else field.onChangeText({ nativeEvent: { text: value } }); };
  return { ...f, r, props, commands, root, motions, buffer, input, render: beforeEffects => r.render(() => { const tree = s.expand(module[`AdminItemCreate${kind}`]({ model: f.model, props, render: props.renderPrimaryAction })); beforeEffects?.(tree); return tree; }) };
}
module.exports = { ...s, fixture, view };
