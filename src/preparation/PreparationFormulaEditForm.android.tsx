import { Host, IconButton, LinearProgressIndicator, OutlinedButton, RNHostView, Row, Shape, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { View, useWindowDimensions } from 'react-native';
import { InventorySheetButton } from './PreparationInventoryDetails.android';
import type { FormulaEditorRow } from './preparationLogic';
import { PreparationField, usePreparationText } from './PreparationUI.android';

type Props = {
  name: string; creating: boolean; context: string; rows: readonly FormulaEditorRow[];
  total: string | null; error: string | null; saving: boolean; canSave: boolean;
  choose: (index: number) => void; update: (index: number, percent: string) => void;
  add: () => void; remove: (index: number) => void; save: () => void; cancel: () => void;
};

export function PreparationFormulaEditForm({ name, creating, context, rows, total, error, saving, canSave, choose, update, add, remove, save, cancel }: Props) {
  const colors = useMaterialColors(), t = usePreparationText();
  const displayError = rows.some(row => row.percent.trim()) ? error : null;
  const progress = total === null ? 0 : Math.max(0, Math.min(1, Number(total) / 100));
  return <View style={{ gap: 16 }}>
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Host matchContents={{ vertical: true }} style={{ flex: 1 }}>
          <Text color={colors.onSurface} style={{ typography: 'titleLarge' }}>{t(creating ? 'Yangi formula' : 'Tahrirlash')}</Text>
        </Host>
        <View style={{ backgroundColor: colors.secondaryContainer, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 }}>
          <Host matchContents><Text color={colors.onSecondaryContainer} style={{ typography: 'titleMedium' }}>{name}</Text></Host>
        </View>
      </View>
      {context ? <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{context}</Text>
      </Host> : null}
      {creating ? <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{t('Nom avtomatik beriladi')}</Text>
      </Host> : null}
    </View>
    {rows.map((row, index) => <IngredientRow key={`${index}:${row.material?.code ?? ''}`} row={row} index={index}
      disabled={saving} canRemove={rows.length > 1} choose={() => choose(index)} update={value => update(index, value)} remove={() => remove(index)} />)}
    <InventorySheetButton label="Seriyo qo‘shish" kind="outlined" disabled={saving} onPress={add} />
    <View style={{ gap: 8, paddingHorizontal: 4, paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Host matchContents><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge' }}>{t('Jami')}</Text></Host>
        <Host matchContents><Text color={total !== null && Number(total) > 100 ? colors.error : colors.onSurface}
          style={{ typography: 'titleMedium' }}>{total === null ? '— / 100%' : `${total}% / 100%`}</Text></Host>
      </View>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <LinearProgressIndicator progress={progress} color={total !== null && Number(total) > 100 ? colors.error : colors.primary}
          trackColor={colors.surfaceContainerHighest} modifiers={[fillMaxWidth()]} />
      </Host>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <Text color={displayError ? colors.error : colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>
          {t(displayError || '100% shart')}
        </Text>
      </Host>
    </View>
    <View style={{ gap: 4 }}>
      <InventorySheetButton label={saving ? 'Saqlanmoqda…' : 'Saqlash'} large id="preparation-formula-save" disabled={!canSave} onPress={save} />
      <InventorySheetButton label="Bekor qilish" kind="text" disabled={saving} onPress={cancel} />
    </View>
  </View>;
}

function IngredientRow({ row, index, disabled, canRemove, choose, update, remove }: {
  row: FormulaEditorRow; index: number; disabled: boolean; canRemove: boolean;
  choose: () => void; update: (value: string) => void; remove: () => void;
}) {
  const colors = useMaterialColors(), t = usePreparationText(), { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  return <View style={{ padding: 12, gap: 10, borderRadius: 20, backgroundColor: colors.surface }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }}>
      <Host matchContents={{ vertical: true }} style={{ flex: 1 }}>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'labelLarge' }}>{`${index + 1}-seriyo`}</Text>
      </Host>
      {canRemove ? <Host style={{ width: 48, height: 48 }}>
        <IconButton enabled={!disabled} onClick={remove} modifiers={[size(48, 48), semantics({ contentDescription: t('Olib tashlash') }), testID(`preparation-formula-remove-${index}`)]}>
          <RNHostView matchContents><SymbolView name={{ android: 'delete_outline' }} size={22} tintColor={colors.onSurfaceVariant} /></RNHostView>
        </IconButton>
      </Host> : null}
    </View>
    <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 12, alignItems: 'stretch' }}>
      <View style={stacked ? undefined : { flex: 1 }}>
        <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
          <OutlinedButton enabled={!disabled} onClick={choose} contentPadding={{ start: 12, end: 12 }}
            shape={Shape.RoundedCorner({ cornerRadii: { topStart: 8, topEnd: 8, bottomStart: 8, bottomEnd: 8 } })}
            modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID(`preparation-formula-material-${index}`)]}>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
              <Text maxLines={1} overflow="ellipsis" modifiers={[weight(1)]}>{row.material?.name || row.material?.code || t('Seriyo tanlang')}</Text>
              <RNHostView matchContents><SymbolView name={{ android: 'expand_more' }} size={22} tintColor={colors.onSurfaceVariant} /></RNHostView>
            </Row>
          </OutlinedButton>
        </Host>
      </View>
      <View style={stacked ? undefined : { width: 112 }}>
        <PreparationField label="Foiz (%)" initial={row.percent} enabled={!disabled && !!row.material} decimal onChange={update} />
      </View>
    </View>
  </View>;
}
