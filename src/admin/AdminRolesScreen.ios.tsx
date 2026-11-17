import { BottomSheet, Button, Group, HStack, Image, List, Picker, ProgressView, Section, Spacer, TabView, Text, TextField, Toggle, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, animation, Animation, buttonStyle, controlSize, disabled, font, foregroundStyle, frame,
  listRowBackground, listRowSeparator, listStyle, padding, pickerStyle, presentationDetents, presentationDragIndicator, refreshable, scrollContentBackground, tabViewStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import type { AdminRolesScreenProps } from './AdminRolesTypes';
import { useAdminRoles, type AdminRolesScreenModel } from './useAdminRoles';

/** @v2 _RoleDefinitionTile */
function RoleRow({ row, model }: { row: AdminRolesScreenModel['roles'][number]; model: AdminRolesScreenModel }) {
  return <VStack alignment="leading" spacing={0} modifiers={[listRowSeparator('hidden'), listRowBackground('clear'), animation(Animation.easeOut({ duration: .18 }), row.expanded)]}>
    <HStack spacing={12}><Button onPress={() => model.controller.expand(row.role.id)} modifiers={[buttonStyle('plain'), accessibilityIdentifier(`admin-role-card-${row.role.id}`)]}>
      <HStack spacing={14}><Image systemName={row.role.system ? 'person.badge.shield.checkmark' : 'checkmark.shield'} size={20} />
        <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'headline' })]}>{row.label}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{row.summary}</Text>
        </VStack>
      </HStack>
    </Button>{row.editable ? <Button onPress={() => model.controller.openEditor(row.role)} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ minWidth: 44, minHeight: 44 }),
      accessibilityLabel(model.t('adminEditRole')), accessibilityIdentifier(`admin-role-edit-${row.role.id}`)]}><Image systemName="pencil" size={18} /></Button> : null}
      <Button onPress={() => model.controller.expand(row.role.id)} modifiers={[buttonStyle('plain'), frame({ minWidth: 44, minHeight: 44 }),
        accessibilityLabel(model.t(row.expanded ? 'adminRoleDetailsHide' : 'adminRoleDetailsShow')), accessibilityIdentifier(`admin-role-details-${row.role.id}`)]}>
        <Image systemName={row.expanded ? 'chevron.up' : 'chevron.down'} size={18} />
      </Button>
    </HStack>{row.expanded && row.capabilityText ? <Text modifiers={[font({ textStyle: 'subheadline' }), padding({ leading: 44, top: 4, trailing: 12, bottom: 12 })]}>{row.capabilityText}</Text> : null}
  </VStack>;
}
/** @v2 _RoleAssignmentTile */
function AssignmentRow({ row, index, model }: { row: AdminRolesScreenModel['principals'][number]; index: number; model: AdminRolesScreenModel }) {
  const icon = row.principal.icon === 'badge' ? 'person.text.rectangle' : row.principal.icon === 'local_shipping' ? 'truck.box' : row.principal.icon === 'precision_manufacturing' ? 'gearshape.2' : 'person';
  return <HStack spacing={14} modifiers={[listRowSeparator('hidden')]}><Image systemName={icon} size={20} /><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'headline' })]}>{row.principal.name}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{row.subtitle}</Text>
    <Text modifiers={[font({ textStyle: 'subheadline' })]}>{row.assignedLabel}</Text>{row.apparatusText ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{row.apparatusText}</Text> : null}
  </VStack><Button label={model.t('archiveSelectDateAction')} onPress={() => model.controller.openAssignment(row.principal)} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ minHeight: 44 }), accessibilityIdentifier(`admin-role-assignment-${index}`)]} /></HStack>;
}
function Scope({ model }: { model: AdminRolesScreenModel }) {
  const sheet = model.state.sheet!; if (sheet.kind !== 'assignment') return null;
  return <VStack alignment="leading" spacing={6}>{sheet.data.apparatus.length ? <><Text modifiers={[font({ textStyle: 'headline' })]}>{model.a('scope.allowed')}</Text>
    {sheet.data.apparatus.map((item, index) => <Toggle key={`${item.id}:${index}`} label={item.name} isOn={!!item.id && sheet.selected.includes(item.id)}
      onIsOnChange={value => model.controller.toggleApparatus(sheet.id, item.id, value)} modifiers={[disabled(!item.id || sheet.closing), frame({ minHeight: 44 }), accessibilityIdentifier(`admin-role-apparatus-${index}`)]} />)}
  </> : <Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('scope.empty')}</Text>}</VStack>;
}
/** @v2 _AdminRoleEditorSheet
 * @v2 _RoleAssignmentSheet
 */
function RolesSheet({ model }: { model: AdminRolesScreenModel }) {
  const sheet = model.state.sheet!, label = useNativeState(sheet.kind === 'editor' ? sheet.label : '');
  return <BottomSheet isPresented={!sheet.closing} onIsPresentedChange={presented => { if (!presented) model.controller.closeSheet(sheet.id); }} onDismiss={() => model.controller.nativeDismiss(sheet.id)}>
    <Group modifiers={[presentationDetents(sheet.kind === 'editor' ? [{ fraction: .82 }] : ['medium', 'large']), presentationDragIndicator('visible')]}>
      {sheet.kind === 'editor' ? <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), padding({ horizontal: 20, bottom: 20 })]}>
        <HStack><Text modifiers={[font({ textStyle: 'title3', weight: 'bold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.t(sheet.role ? 'adminEditRole' : 'adminNewRole')}</Text>
          <Button onPress={() => model.controller.saveEditor(sheet.id)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(!model.canSaveEditor), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(model.t('save')), accessibilityIdentifier('admin-role-save-action')]}><Image systemName="checkmark" size={20} /></Button>
        </HStack><Spacer modifiers={[frame({ height: 16 })]} /><VStack alignment="leading" spacing={6}><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{model.t('adminRoleNameLabel')}</Text>
          <TextField text={label} placeholder={model.t('adminRoleNameLabel')} onTextChange={value => model.controller.setLabel(sheet.id, value)} modifiers={[disabled(sheet.closing), accessibilityIdentifier('admin-role-name')]} />
        </VStack><Spacer modifiers={[frame({ height: 12 })]} /><List modifiers={[listStyle('plain'), scrollContentBackground('hidden')]}>
          {sheet.data.capabilities.map((capability, index) => <VStack key={`${capability.code}:${index}`} alignment="leading" spacing={4}>
            <Toggle label={model.capabilityLabel(capability.code)} isOn={sheet.capabilities.includes(capability.code)} onIsOnChange={checked => model.controller.toggleCapability(sheet.id, capability.code, checked)} modifiers={[disabled(sheet.closing), accessibilityIdentifier(`admin-role-capability-${capability.code}`)]} />
            <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{capability.code}</Text>
          </VStack>)}
        </List>
      </VStack> : <List modifiers={[listStyle('plain')]}><Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{model.m('adminRoleForPrincipal', { name: sheet.principal.name })}</Text>
        {model.options.map((row, index) => <Section key={`${row.role.id}:${index}`}>
          <Button onPress={() => model.controller.assign(sheet.id, row.role)} modifiers={[buttonStyle('plain'), disabled(!row.enabled || sheet.closing), frame({ minHeight: 44 }), accessibilityIdentifier(`admin-role-option-${row.role.id}`)]}>
            <HStack spacing={14}><Image systemName={row.role.system ? 'person.badge.shield.checkmark' : 'checkmark.shield'} size={22} /><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
              <Text>{row.label}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{row.subtitle}</Text>
            </VStack></HStack>
          </Button>{row.apparatus ? <><Scope model={model} /><Button label={model.t('save')} onPress={() => model.controller.assign(sheet.id, row.role)}
            modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(!row.enabled || sheet.closing), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier(`admin-role-apparatus-save-${row.role.id}`)]} /></> : null}
        </Section>)}
      </List>}
    </Group>
  </BottomSheet>;
}

/** @v2 AdminRolesScreen */
export function AdminRolesScreen(props: AdminRolesScreenProps) {
  const model = useAdminRoles(props), { state } = model, { colors } = useBaseTheme(), insets = useSafeAreaInsets(); if (!model.current) return null;
  const roleList = <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), refreshable(() => model.controller.reload())]}>
    <Button label={model.t('adminNewRole')} systemImage="plus" onPress={() => model.controller.openEditor()} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 }), listRowSeparator('hidden'), accessibilityIdentifier('admin-role-create')]} />
    {model.roles.map((row, index) => <RoleRow key={`${row.role.id}:${index}`} row={row} model={model} />)}<Spacer modifiers={[frame({ height: insets.bottom + 136 }), listRowBackground('clear'), listRowSeparator('hidden')]} />
  </List>;
  const assignmentList = <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), refreshable(() => model.controller.reload())]}>
    {model.principals.map((row, index) => <AssignmentRow key={`${row.principal.role}:${row.principal.ref}:${index}`} row={row} index={index} model={model} />)}
    <Spacer modifiers={[frame({ height: insets.bottom + 136 }), listRowBackground('clear'), listRowSeparator('hidden')]} />
  </List>;
  return <><Stack.Screen options={{ headerShown: true, title: model.t('adminRolesTitle'), headerBackVisible: false, headerRight: props.profileAction ? () => props.profileAction : undefined,
    headerLeft: () => <BaseHost matchContents><Button onPress={props.navigation.onPress} modifiers={[buttonStyle('plain'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(props.navigation.label)]}><Image systemName={props.navigation.icon === 'back' ? 'chevron.left' : 'line.3.horizontal'} size={20} /></Button></BaseHost> }} />
    <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh }]}>{props.topNotice}<AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-roles-body-frame"><BaseHost style={styles.screen}>
      {!state.data ? state.loading ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><ProgressView /></VStack> : <VStack spacing={16} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <Text>{model.t('serverDisconnectedRetry')}</Text><Button label={model.t('retry')} onPress={() => { void model.controller.reload(); }} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ minHeight: 44 })]} />
      </VStack> : <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        {state.refreshing ? <ProgressView /> : null}<Picker selection={state.tab} onSelectionChange={value => { if (value === 0 || value === 1) model.controller.selectTab(value); }} modifiers={[pickerStyle('segmented'), padding({ horizontal: 4, vertical: 4 })]}>
          <Text modifiers={[tag(0)]}>{model.t('adminRolesTitle')}</Text><Text modifiers={[tag(1)]}>{model.t('adminRolesAssignTab')}</Text>
        </Picker><TabView selection={String(state.tab)} onSelectionChange={value => { if (value === '0' || value === '1') model.controller.selectTab(value === '0' ? 0 : 1); }} modifiers={[tabViewStyle({ type: 'page', indexDisplayMode: 'never' })]}>
          <TabView.Tab value="0">{roleList}</TabView.Tab><TabView.Tab value="1">{assignmentList}</TabView.Tab>
        </TabView>
      </VStack>}
      {state.sheet ? <RolesSheet key={state.sheet.id} model={model} /> : null}
    </BaseHost></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
      {model.snackbar ? <PreparationNotice key={model.snackbar.serial} message={model.snackbar.message} /> : null}
    </View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
