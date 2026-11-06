import { Button, ContextMenu, Host, List, Section, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { disabled, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationInputDialog } from './PreparationInputDialog';
import { PreparationNotice } from './PreparationNotice';
import { PreparationList, PreparationStatus, preparationAlert, usePreparationText } from './PreparationUI';
import { PreparationVariantNameSheet } from './PreparationFormulaSheets';
import { PreparationVariantNameDialog } from './PreparationVariantNameDialog';
import { PreparationSharesDialog } from './PreparationSharesDialog';
import { preparationCatalogSubtitle, preparationSetSubtitle } from './preparationLibraryPresentation';
import { openPreparationFormula, openPreparationRoute } from './PreparationRoutes';
import { preparationFormulaErrorMessage } from './usePreparationFormula';
import { preparationVariantName, usePreparationLibrary } from './usePreparationLibrary';
import { usePreparationNotice } from './usePreparationNotice';
import { usePreparationSetDetail } from './usePreparationSetDetail';

type Library = ReturnType<typeof usePreparationLibrary>;
type Recipe = Library['recipes'][number];
type FormulaSet = Library['sets'][number];
function LibraryRow({ title, subtitle, busy, open, actions }: { title: string; subtitle: string; busy: boolean; open: () => void; actions: () => void }) {
  return <Button modifiers={[disabled(busy), onLongPressGesture(actions)]} onPress={open}>
    <VStack alignment="leading"><Text>{title}</Text><Text>{subtitle}</Text></VStack>
  </Button>;
}
function RenameAction({ title, subtitle, choose }: { title: string; subtitle?: string; choose: () => void }) {
  const t = usePreparationText();
  return <Host matchContents={{ vertical: true }}><VStack spacing={12}><Text>{title}</Text>{!!subtitle && <Text>{subtitle}</Text>}
    <Button label={t('Nomini o‘zgartirish')} onPress={choose} /></VStack></Host>;
}
function openRecipe(recipe: Recipe) {
  openPreparationFormula({ orderId: '', orderCode: '', productCode: recipe.product_code, productTitle: recipe.product_title,
    materialId: recipe.material_id, materialName: recipe.material_name, variantId: recipe.id, variantName: recipe.name, variantCode: recipe.formula_code,
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
  const [renameTarget, setRenameTarget] = useState<Recipe | null>(null), afterSheet = useRef<(() => void) | null>(null);
  const reload = useCallback(() => controller.load(), [controller]); useReloadOnReturn(reload);
  const rename = (recipe: Recipe) => sheet.open(<RenameAction title={recipe.name} subtitle={recipe.formula_code} choose={() => {
    afterSheet.current = () => setRenameTarget(recipe); sheet.close();
  }} />, { compact: true, dismissible: true, onDismiss: () => { const next = afterSheet.current; afterSheet.current = null; next?.(); } });
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('Formulalar') }} /><PreparationList refresh={reload}>
    <Section><TextField placeholder={t('Formula nomi, kodi yoki buyurtmani qidirish')} onTextChange={value => controller.setQuery(value)} />
      <Text>{t(`Barcha buyurtmalarning formulalari: ${state.filteredRecipes.length} ta`)}</Text></Section>
    <PreparationStatus loading={state.loading || state.busy} error={state.error} retry={() => { void reload(); }} />
    <Section>
      {!state.loading && !state.error && !state.filteredRecipes.length && <Text>{t(state.query.trim() ? 'Formula topilmadi.' : 'Saqlangan formulalar yo‘q.')}</Text>}
      {state.filteredRecipes.map(recipe => <LibraryRow key={recipe.id} title={recipe.name} subtitle={preparationCatalogSubtitle(recipe)}
        busy={state.busy || state.loading} open={() => openRecipe(recipe)} actions={() => rename(recipe)} />)}
    </Section>
  </PreparationList>{renameTarget && <PreparationVariantNameDialog initial={renameTarget.name} save={async name => {
    try { if (!await controller.renameRecipe(renameTarget, name)) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching'); return true; }
    catch (error) { throw new Error(preparationFormulaErrorMessage(error)); }
  }} finish={() => setRenameTarget(null)} />}</View>;
}

// @v2 PreparationFormulaOrdersScreen
export function PreparationFormulaSets() {
  const { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet(), notice = usePreparationNotice();
  const state = usePreparationLibrary(session, 'sets'), { controller } = state;
  const [renameTarget, setRenameTarget] = useState<FormulaSet | null>(null), afterSheet = useRef<(() => void) | null>(null);
  const reload = useCallback(() => controller.load(), [controller]); useReloadOnReturn(reload);
  const rename = (set: FormulaSet) => sheet.open(<RenameAction title={set.set_id} choose={() => {
    afterSheet.current = () => setRenameTarget(set); sheet.close();
  }} />, { compact: true, dismissible: true, onDismiss: () => { const next = afterSheet.current; afterSheet.current = null; next?.(); } });
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('Formulalar') }} /><PreparationList refresh={reload}>
    <Section><TextField placeholder={t('Kod, nom yoki buyurtmani qidirish')} onTextChange={value => controller.setQuery(value)} /></Section>
    <PreparationStatus loading={state.loading || state.busy} error={state.error} retry={() => { void reload(); }} />
    <Section>
      {!state.loading && !state.error && !state.filteredSets.length && <Text>{t(state.query.trim() ? 'Formula komplekti topilmadi.' : 'Saqlangan formulalar yo‘q.')}</Text>}
      {state.filteredSets.map(set => <LibraryRow key={set.set_id} title={set.name} subtitle={preparationSetSubtitle(set, controller.recipeCount(set))}
        busy={state.busy || state.loading} open={() => openPreparationRoute('set-detail', { id: set.set_id })} actions={() => rename(set)} />)}
    </Section>
  </PreparationList><PreparationNotice message={notice.message} />
    {renameTarget && <PreparationInputDialog key={renameTarget.set_id} title="Komplekt nomini o‘zgartirish" label="Komplekt nomi" initial={renameTarget.name}
      close={() => setRenameTarget(null)} save={name => { const set = renameTarget; setRenameTarget(null);
        void controller.renameSet(set, name).then(saved => { if (saved) notice.show(t('Komplekt nomi o‘zgartirildi')); })
          .catch(error => notice.show(preparationFormulaErrorMessage(error))); }} />}
  </View>;
}

function LegacyFormulaSheet({ entry, select }: {
  entry: FormulaSet['formulas'][number]; select: (action: 'shares' | 'edit' | 'delete') => void;
}) {
  const t = usePreparationText();
  return <Host style={{ minHeight: 280 }}><VStack><Text>{t('Formula ma’lumotlari')}</Text><Text>{entry.formula.name}</Text><Text>{entry.material_name}</Text><List>
    {entry.formula.lines.map(line => <Text key={line.item_code}>{line.name} · {line.percent}%</Text>)}
  </List><Button label={t('Tahrirlash')} onPress={() => select('edit')} />
    <Button label={t('O‘chirish')} role="destructive" onPress={() => select('delete')} />
    <Button label={t('Shnek ulushlarini belgilash')} onPress={() => select('shares')} /></VStack></Host>;
}

function SetDetailsContent({ set, recipes }: { set: FormulaSet; recipes: Recipe[] }) {
  const { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const state = usePreparationSetDetail(session, set, recipes), { controller } = state;
  const [shareEntry, setShareEntry] = useState<FormulaSet['formulas'][number] | null>(null);
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
  const details = (entry: typeof state.legacyFormulas[number]) => {
    let selected: 'shares' | 'edit' | 'delete' | null = null;
    sheet.open(<LegacyFormulaSheet entry={entry} select={action => { selected = action; sheet.close(); }} />,
      { compact: true, dismissible: true, onDismiss: () => {
        if (selected === 'shares') setShareEntry(entry);
        else if (selected === 'edit') edit(entry);
        else if (selected === 'delete') remove(entry);
      } });
  };
  const shares = (entry: typeof state.legacyFormulas[number]) => setShareEntry(entry);
  return <><Stack.Screen options={{ title: set.name }} /><PreparationList refresh={reload}>
    <Section><Text>{t('Katalogdagi o‘zgarishlar formula keyingi safar buyurtmaga biriktirilganda olinadi.')}</Text></Section>
    <PreparationStatus loading={state.busy} error={state.error} retry={() => { void reload(); }} />
    <Section>{!state.recipes.length && !state.legacyFormulas.length && <Text>{t('Bu komplektda formula qolmadi.')}</Text>}
      {state.recipes.map(recipe => <ContextMenu key={recipe.id}><ContextMenu.Trigger><Button modifiers={[disabled(state.busy)]} onPress={() => openRecipe(recipe)}>
        <VStack alignment="leading"><Text>{recipe.name}</Text><Text>{recipe.material_name} · {recipe.formula_code}</Text></VStack>
      </Button></ContextMenu.Trigger><ContextMenu.Items><Button label={t('Nomini o‘zgartirish')} modifiers={[disabled(state.busy)]} onPress={() => rename(recipe)} />
      </ContextMenu.Items></ContextMenu>)}
      {state.legacyFormulas.map(entry => <ContextMenu key={`${entry.material_id}:${entry.formula.name}`}><ContextMenu.Trigger>
        <Button modifiers={[disabled(state.busy)]} onPress={() => details(entry)}><VStack alignment="leading"><Text>{entry.formula.name}</Text><Text>{entry.material_name}</Text></VStack></Button>
      </ContextMenu.Trigger><ContextMenu.Items><Button label={t('Tahrirlash')} onPress={() => edit(entry)} />
        <Button label={t('Shnek ulushlarini belgilash')} onPress={() => shares(entry)} />
        <Button label={t('O‘chirish')} role="destructive" onPress={() => remove(entry)} /></ContextMenu.Items></ContextMenu>)}
    </Section>
  </PreparationList>{shareEntry && <PreparationSharesDialog formulas={controller.formulasFor(shareEntry)} materialName={shareEntry.material_name}
    close={() => setShareEntry(null)} save={values => controller.saveShares(shareEntry, values)} />}</>;
}
export function PreparationFormulaSetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(), { session } = usePreparationContext();
  const state = usePreparationLibrary(session, 'sets');
  const set = state.sets.find(item => item.set_id === id);
  if (set) return <SetDetailsContent set={set} recipes={state.recipes.filter(item => item.product_code === set.product_code)} />;
  return <PreparationList refresh={() => state.controller.load()}><PreparationStatus loading={state.loading} error={state.error}
    retry={() => { void state.controller.load(); }} /></PreparationList>;
}
