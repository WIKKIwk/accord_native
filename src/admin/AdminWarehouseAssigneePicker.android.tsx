import { Column, ModalBottomSheet, RNHostView, Shape, Surface, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, imePadding, padding, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { PickerSheetContent } from '../shared/orders/PickerSheetContent.android';
import { adminUserRoleLabel, type AdminUserListEntry } from './adminUsersModel';

type Props = {
  users: readonly AdminUserListEntry[];
  title: string; hint: string; closeLabel: string; emptyLabel: string; searchTestID: string; query: string;
  onSearch: (query: string) => void; onSelect: (user: AdminUserListEntry) => void; onDismiss: () => void;
};

export function AdminWarehouseAssigneePicker({ users, onSelect, onDismiss, query, ...picker }: Props) {
  const { colors } = useBaseTheme(), { height: screenHeight } = useWindowDimensions();
  const sheet = useRef<ModalBottomSheetRef>(null), hiding = useRef(false);
  const [initialQuery] = useState(query);
  const hide = async (action: () => void) => {
    if (hiding.current) return;
    hiding.current = true;
    try { await sheet.current?.hide(); action(); } finally { hiding.current = false; }
  };
  const items = users.map((user, index) => ({ key: `${user.kind}:${user.id}:${index}`, title: user.name,
    subtitle: adminUserRoleLabel(user), select: () => { void hide(() => onSelect(user)); } }));
  return <ModalBottomSheet ref={sheet} skipPartiallyExpanded initialFullyExpanded showDragHandle={false} sheetGesturesEnabled
    scrimColor="rgba(0,0,0,0.32)" containerColor={colors.surface} onDismissRequest={onDismiss}>
    <Column modifiers={[fillMaxWidth(), height(screenHeight * .66), imePadding(), padding(0, 12, 0, 24)]}>
      <Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Surface color={colors.outlineVariant} shape={Shape.RoundedCorner({ cornerRadii: { topStart: 999, topEnd: 999, bottomStart: 999, bottomEnd: 999 } })}
          modifiers={[size(36, 4)]} />
      </Column>
      <RNHostView modifiers={[fillMaxWidth(), weight(1)]}><PickerSheetContent {...picker} items={items} query={initialQuery} onClose={() => { void hide(onDismiss); }} /></RNHostView>
    </Column>
  </ModalBottomSheet>;
}
