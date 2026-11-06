import { Button, ContextMenu, Section, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationInputSheet, PreparationList, PreparationStatus, preparationAlert, usePreparationText } from './PreparationUI';
import { PreparationSharesSheet, PreparationVariantNameSheet } from './PreparationFormulaSheets';
import { openPreparationFormula, openPreparationRoute } from './PreparationRoutes';
import { preparationVariantName, usePreparationLibrary } from './usePreparationLibrary';
import { usePreparationSetDetail } from './usePreparationSetDetail';

type Library = ReturnType<typeof usePreparationLibrary>;
type Recipe = Library['recipes'][number];
type FormulaSet = Library['sets'][number];
function openRecipe(recipe: Recipe) {
  openPreparationFormula({ orderId: '', orderCode: '', productCode: recipe.product_code, productTitle: recipe.product_title,
    materialId: recipe.material_id, materialName: recipe.material_name, variantId: recipe.id, variantName: recipe.name,
    manageSavedFormula: true, allowAddingFormula: recipe.can_create });
}
function useReloadOnReturn(load: () => Promise<void>) {
  const first = useRef(true);
  useFocusEffect(useCallback(() => { if (first.current) first.current = false; else void load(); }, [load]));
}

// @v2 PreparationFormulaCatalogScreen
export function PreparationFormulaCatalog() {
  const { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const state = usePreparationLibrary(session, 'catalog'), { controller } = state;
  const reload = useCallback(() => controller.load(), [controller]); useReloadOnReturn(reload);
  const rename = (recipe: Recipe) => sheet.open(<PreparationVariantNameSheet initial={recipe.name} close={sheet.close}
    save={name => controller.renameRecipe(recipe, name)} />, { compact: true, dismissible: false });
  return <><Stack.Screen options={{ title: t('Formulalar') }} /><PreparationList refresh={reload}>
    <Section><TextField placeholder={t('Formula nomi, kodi yoki buyurtmani qidirish')} onTextChange={value => controller.setQuery(value)} />
      <Text>{t(`Barcha buyurtmalarning formulalari: ${state.filteredRecipes.length} ta`)}</Text></Section>
    <PreparationStatus loading={state.loading || state.busy} error={state.error} retry={() => { void reload(); }} />
    {!state.loading && !state.error && <Section>
      {!state.filteredRecipes.length && <Text>{t(state.query.trim() ? 'Formula topilmadi.' : 'Saqlangan formulalar yo‘q.')}</Text>}
      {state.filteredRecipes.map(recipe => <ContextMenu key={recipe.id}><ContextMenu.Trigger>
        <Button modifiers={[disabled(state.busy)]} onPress={() => openRecipe(recipe)}><VStack alignment="leading">
          <Text>{recipe.name}</Text><Text>{[recipe.formula_code, recipe.product_title, recipe.material_name, recipe.order_codes.join(', ')].filter(Boolean).join(' · ')}</Text>
        </VStack></Button></ContextMenu.Trigger><ContextMenu.Items>
          <Button label={t('Nomini o‘zgartirish')} modifiers={[disabled(state.busy || state.loading)]} onPress={() => rename(recipe)} />
        </ContextMenu.Items></ContextMenu>)}
    </Section>}
  </PreparationList></>;
}

// @v2 PreparationFormulaOrdersScreen
export function PreparationFormulaSets() {
  const { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const state = usePreparationLibrary(session, 'sets'), { controller } = state;
  const reload = useCallback(() => controller.load(), [controller]); useReloadOnReturn(reload);
  const rename = (set: FormulaSet) => sheet.open(<PreparationInputSheet title="Komplekt nomini o‘zgartirish" label="Komplekt nomi" initial={set.name}
    close={sheet.close} save={name => controller.renameSet(set, name)} />, { compact: true, dismissible: false });
  return <><Stack.Screen options={{ title: t('Formulalar') }} /><PreparationList refresh={reload}>
    <Section><TextField placeholder={t('Kod, nom yoki buyurtmani qidirish')} onTextChange={value => controller.setQuery(value)} /></Section>
    <PreparationStatus loading={state.loading || state.busy} error={state.error} retry={() => { void reload(); }} />
    {!state.loading && !state.error && <Section>
      {!state.filteredSets.length && <Text>{t(state.query.trim() ? 'Formula komplekti topilmadi.' : 'Saqlangan formulalar yo‘q.')}</Text>}
      {state.filteredSets.map(set => <ContextMenu key={set.set_id}><ContextMenu.Trigger>
        <Button modifiers={[disabled(state.busy)]} onPress={() => openPreparationRoute('set-detail', { id: set.set_id })}>
          <VStack alignment="leading"><Text>{set.name}</Text><Text>{set.set_id} · {controller.recipeCount(set)} ta formula</Text></VStack>
        </Button></ContextMenu.Trigger><ContextMenu.Items>
          <Button label={t('Nomini o‘zgartirish')} modifiers={[disabled(state.loading || state.busy)]} onPress={() => rename(set)} />
        </ContextMenu.Items></ContextMenu>)}
    </Section>}
  </PreparationList></>;
}

function SetDetailsContent({ set, recipes }: { set: FormulaSet; recipes: Recipe[] }) {
  const { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const state = usePreparationSetDetail(session, set, recipes), { controller } = state;
  const reload = useCallback(() => controller.reload(), [controller]); useReloadOnReturn(reload);
  const rename = (recipe: Recipe) => sheet.open(<PreparationVariantNameSheet initial={recipe.name} close={sheet.close} save={async name => {
    const { preparationRenameFormulaVariant } = await import('./preparationFormulaApi');
    await preparationRenameFormulaVariant(session, { productCode: recipe.product_code, materialId: recipe.material_id, variantId: recipe.id, name: preparationVariantName(name) });
    await reload();
  }} />, { compact: true, dismissible: false });
  const remove = (entry: typeof state.legacyFormulas[number]) => Alert.alert(t('Formulani o‘chirish'), `«${entry.formula.name}» formulasi o‘chirilsinmi?`, [
    { text: t('Bekor qilish'), style: 'cancel' }, { text: t('O‘chirish'), style: 'destructive', onPress: () => { void controller.remove(entry).catch(preparationAlert); } },
  ]);
  const edit = (entry: typeof state.legacyFormulas[number]) => openPreparationFormula({ orderId: set.set_id, orderCode: set.set_id,
    productCode: set.product_code, productTitle: set.name, materialId: entry.material_id, materialName: entry.material_name,
    initialFormulaName: entry.formula.name, variantId: entry.variant_id, variantName: entry.variant_name, manageSavedFormula: true });
  const shares = (entry: typeof state.legacyFormulas[number]) => sheet.open(<PreparationSharesSheet formulas={controller.formulasFor(entry)}
    close={sheet.close} save={values => controller.saveShares(entry, values)} />, { compact: true, dismissible: false });
  return <><Stack.Screen options={{ title: set.name }} /><PreparationList refresh={reload}>
    <Section><Text>{t('Katalogdagi o‘zgarishlar formula keyingi safar buyurtmaga biriktirilganda olinadi.')}</Text></Section>
    <PreparationStatus loading={state.busy} error={state.error} retry={() => { void reload(); }} />
    <Section>{!state.recipes.length && !state.legacyFormulas.length && <Text>{t('Bu komplektda formula qolmadi.')}</Text>}
      {state.recipes.map(recipe => <ContextMenu key={recipe.id}><ContextMenu.Trigger><Button modifiers={[disabled(state.busy)]} onPress={() => openRecipe(recipe)}>
        <VStack alignment="leading"><Text>{recipe.name}</Text><Text>{recipe.material_name} · {recipe.formula_code}</Text></VStack>
      </Button></ContextMenu.Trigger><ContextMenu.Items><Button label={t('Nomini o‘zgartirish')} modifiers={[disabled(state.busy)]} onPress={() => rename(recipe)} />
      </ContextMenu.Items></ContextMenu>)}
      {state.legacyFormulas.map(entry => <ContextMenu key={`${entry.material_id}:${entry.formula.name}`}><ContextMenu.Trigger>
        <Button modifiers={[disabled(state.busy)]} onPress={() => edit(entry)}><VStack alignment="leading"><Text>{entry.formula.name}</Text><Text>{entry.material_name}</Text></VStack></Button>
      </ContextMenu.Trigger><ContextMenu.Items><Button label={t('Tahrirlash')} onPress={() => edit(entry)} />
        <Button label={t('Shnek ulushlarini belgilash')} onPress={() => shares(entry)} />
        <Button label={t('O‘chirish')} role="destructive" onPress={() => remove(entry)} /></ContextMenu.Items></ContextMenu>)}
    </Section>
  </PreparationList></>;
}
export function PreparationFormulaSetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(), { session } = usePreparationContext();
  const state = usePreparationLibrary(session, 'sets');
  const set = state.sets.find(item => item.set_id === id);
  if (set) return <SetDetailsContent set={set} recipes={state.recipes.filter(item => item.product_code === set.product_code)} />;
  return <PreparationList refresh={() => state.controller.load()}><PreparationStatus loading={state.loading} error={state.error}
    retry={() => { void state.controller.load(); }} /></PreparationList>;
}
