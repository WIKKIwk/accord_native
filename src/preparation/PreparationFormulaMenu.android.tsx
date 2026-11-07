import { Box, DropdownMenu, DropdownMenuItem, Host, RNHostView, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { size } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { usePreparationText } from './PreparationUI.android';

export type FormulaMenuAction = 'edit' | 'delete' | 'rename';
const options = {
  edit: { label: 'Tahrirlash', icon: 'edit' },
  delete: { label: 'O‘chirish', icon: 'delete' },
  rename: { label: 'Nomini o‘zgartirish', icon: 'drive_file_rename_outline' },
} as const;
const defaultActions: readonly FormulaMenuAction[] = ['edit', 'delete'];

export function PreparationFormulaMenu({ name, disabled = false, actions = defaultActions, onSelect }: {
  name: string; disabled?: boolean; actions?: readonly FormulaMenuAction[]; onSelect: (action: FormulaMenuAction) => void;
}) {
  const colors = useMaterialColors(), t = usePreparationText(), [expanded, setExpanded] = useState(false);
  const select = (action: FormulaMenuAction) => {
    setExpanded(false);
    if (!disabled) requestAnimationFrame(() => onSelect(action));
  };
  return <View style={styles.trigger}>
    {expanded && !disabled ? <FormulaMenuPopup close={() => setExpanded(false)} actions={actions} select={select} /> : null}
    <Pressable key="trigger" accessibilityRole="button" accessibilityLabel={`${name} — ${t('Amallar')}`} disabled={disabled}
      onPress={event => { event.stopPropagation(); setExpanded(true); }} style={styles.trigger}>
      <SymbolView name={{ android: 'more_vert' }} size={24} tintColor={colors.onSurfaceVariant} />
    </Pressable>
  </View>;
}

function FormulaMenuPopup({ close, actions, select }: {
  close: () => void; actions: readonly FormulaMenuAction[]; select: (action: FormulaMenuAction) => void;
}) {
  const colors = useMaterialColors(), t = usePreparationText(), [ready, setReady] = useState(false);
  return <Host pointerEvents="none" style={styles.overlay} onLayoutContent={({ nativeEvent }) => {
    if (!ready && nativeEvent.width > 0 && nativeEvent.height > 0) setReady(true);
  }}>
    <DropdownMenu expanded={ready} onDismissRequest={close}>
      <DropdownMenu.Trigger><Box modifiers={[size(48, 48)]} /></DropdownMenu.Trigger>
      <DropdownMenu.Items>{actions.map(action => <DropdownMenuItem key={action} onClick={() => select(action)}>
        <DropdownMenuItem.LeadingIcon><RNHostView matchContents>
          <SymbolView name={{ android: options[action].icon }} size={20} tintColor={colors.onSurfaceVariant} />
        </RNHostView></DropdownMenuItem.LeadingIcon>
        <DropdownMenuItem.Text><Text>{t(options[action].label)}</Text></DropdownMenuItem.Text>
      </DropdownMenuItem>)}</DropdownMenu.Items>
    </DropdownMenu>
  </Host>;
}

const styles = StyleSheet.create({
  trigger: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
