import { AlertDialog, Button, Column, Host, NavigationBar, NavigationBarItem, OutlinedTextField, RNHostView, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BackHandler, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { Drawer } from 'react-native-drawer-layout';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { preparationInputError } from './preparationLogic';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const locale = () => localeController.locale;
export function usePreparationText() {
  const current = useSyncExternalStore(subscribeLocale, locale, locale);
  return (text: string) => uiText(text, current);
}

export function PreparationText({ children, title = false }: { children: string; title?: boolean }) {
  const colors = useMaterialColors();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text color={colors.onSurface}
    style={{ typography: title ? 'titleMedium' : 'bodyMedium' }}>{children}</Text></Host>;
}

export function PreparationButton({ label, onPress, disabled, id }: { label: string; onPress: () => void; disabled?: boolean; id?: string }) {
  const t = usePreparationText();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Button enabled={!disabled} onClick={onPress}
    modifiers={[fillMaxWidth(), ...(id ? [testID(id)] : [])]}><Text>{t(label)}</Text></Button></Host>;
}

export function PreparationField({ label, initial = '', onChange, enabled = true, decimal = false, suffix }: {
  label: string; initial?: string; onChange: (value: string) => void; enabled?: boolean; decimal?: boolean; suffix?: string;
}) {
  const t = usePreparationText();
  const value = useNativeState(initial);
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField value={value} singleLine enabled={enabled}
    onValueChange={onChange} keyboardOptions={{ keyboardType: decimal ? 'decimal' : 'text' }} modifiers={[fillMaxWidth()]}>
    <OutlinedTextField.Label><Text>{t(label)}</Text></OutlinedTextField.Label>
    {suffix ? <OutlinedTextField.Suffix><Text>{suffix}</Text></OutlinedTextField.Suffix> : null}
  </OutlinedTextField></Host>;
}

export function PreparationRow({ title, subtitle, onPress, onLongPress, disabled = false }: {
  title: string; subtitle?: string; onPress?: () => void; onLongPress?: () => void; disabled?: boolean;
}) {
  const colors = useMaterialColors();
  return <Pressable accessibilityRole={onPress || onLongPress ? 'button' : 'text'} accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
    disabled={disabled || (!onPress && !onLongPress)} onPress={onPress} onLongPress={onLongPress}
    style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, opacity: disabled ? 0.55 : 1 }}>
    <PreparationText title>{title}</PreparationText>{subtitle ? <PreparationText>{subtitle}</PreparationText> : null}
  </Pressable>;
}

export function PreparationDock({ root = false, profile = false, actions }: { root?: boolean; profile?: boolean; actions?: () => void }) {
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), t = usePreparationText();
  return <View style={{ paddingBottom: insets.bottom, backgroundColor: colors.surfaceContainerLow }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><NavigationBar containerColor={colors.surfaceContainerLow}
      tonalElevation={0} modifiers={[fillMaxWidth()]}>
      <NavigationBarItem selected={root} onClick={() => router.replace('/android-preparation' as Href)} modifiers={[testID('preparation-home')]}>
        <NavigationBarItem.Icon><RNHostView matchContents><SymbolView name={{ android: 'home' }} size={24} tintColor={colors.onSurface} /></RNHostView></NavigationBarItem.Icon>
        <NavigationBarItem.Label><Text>{t('Tayyorlov')}</Text></NavigationBarItem.Label>
      </NavigationBarItem>
      {actions ? <NavigationBarItem selected={false} onClick={actions} modifiers={[testID('preparation-actions')]}>
        <NavigationBarItem.Icon><RNHostView matchContents><SymbolView name={{ android: 'add' }} size={24} tintColor={colors.onSurface} /></RNHostView></NavigationBarItem.Icon>
        <NavigationBarItem.Label><Text>{t('Amallar')}</Text></NavigationBarItem.Label>
      </NavigationBarItem> : null}
      <NavigationBarItem selected={profile} onClick={() => router.navigate('/android-preparation/profile' as Href)} modifiers={[testID('preparation-profile')]}>
        <NavigationBarItem.Icon><RNHostView matchContents><SymbolView name={{ android: 'person' }} size={24} tintColor={colors.onSurface} /></RNHostView></NavigationBarItem.Icon>
        <NavigationBarItem.Label><Text>{t('Profil')}</Text></NavigationBarItem.Label>
      </NavigationBarItem>
    </NavigationBar></Host>
  </View>;
}

export function PreparationPage({ title, children, refreshing, onRefresh, root = false, drawer = false, actions }: {
  title: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void; root?: boolean; drawer?: boolean; actions?: () => void;
}) {
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), t = usePreparationText();
  const { width } = useWindowDimensions(), [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (!drawerOpen) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { setDrawerOpen(false); return true; });
    return () => listener.remove();
  }, [drawerOpen]);
  const content = <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {drawer && <Pressable accessibilityRole="button" accessibilityLabel={t('Menyu')} testID="preparation-menu" onPress={() => setDrawerOpen(true)} style={{ padding: 8, width: 40 }}>
        <PreparationText>☰</PreparationText></Pressable>}
      {!root && <Pressable accessibilityRole="button" accessibilityLabel={t('Orqaga')}
        onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/android-preparation' as Href); }} style={{ padding: 8 }}>
        <PreparationText>‹</PreparationText></Pressable>}
      <View style={{ flex: 1 }}><PreparationText title>{t(title)}</PreparationText></View>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
      {children}
    </ScrollView>
    <PreparationDock root={root} actions={actions} />
  </View>;
  if (!drawer) return content;
  const navigate = (route: string) => { setDrawerOpen(false); router.replace(route as Href); };
  return <GestureHandlerRootView style={{ flex: 1 }}><Drawer open={drawerOpen} onOpen={() => setDrawerOpen(true)} onClose={() => setDrawerOpen(false)}
    drawerType="front" overlayAccessibilityLabel={t('Menyuni yopish')}
    drawerStyle={{ width: Math.min(320, width - 56), backgroundColor: colors.surfaceContainerLow, borderTopRightRadius: 16, borderBottomRightRadius: 16 }}
    renderDrawerContent={() => <View style={{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: 12, gap: 8 }}>
      <PreparationText title>{t('Tayyorlov masteri')}</PreparationText>
      <PreparationRow title={t('Tayyorlov')} onPress={() => navigate('/android-preparation')} />
      <PreparationRow title={t('Formulalar')} onPress={() => navigate('/android-preparation/formulas')} />
      <PreparationRow title={t('Ishlab chiqarish')} onPress={() => navigate('/android-preparation/production')} />
      <PreparationRow title={t('Ketma-ketlik')} onPress={() => { setDrawerOpen(false); router.push('/android-preparation/sequence' as Href); }} />
      <PreparationRow title={t('Ishlab chiqarilgan homashyolar')} onPress={() => { setDrawerOpen(false); router.push('/android-preparation/inventory' as Href); }} />
      <PreparationRow title={t('Profil')} onPress={() => { setDrawerOpen(false); router.navigate('/android-preparation/profile' as Href); }} />
    </View>}>{content}</Drawer></GestureHandlerRootView>;
}

type Choice = { label: string; subtitle?: string; value: string; disabled?: boolean };
type Dialog = { kind: 'input'; title: string; label: string; initial?: string; quantity?: boolean; maxLength?: number; emptyError?: string;
  validate?: (value: string) => string | null; resolve: (value: string | null) => void }
  | { kind: 'choice'; title: string; choices: Choice[]; message?: string; searchable?: boolean; resolve: (value: string | null) => void }
  | { kind: 'confirm'; title: string; message: string; confirm: string; cancel: string; resolve: (value: boolean) => void }
  | { kind: 'message'; title: string; message: string; resolve: () => void };
type Dialogs = {
  input: (options: Omit<Extract<Dialog, { kind: 'input' }>, 'kind' | 'resolve'>) => Promise<string | null>;
  choose: (title: string, choices: Choice[], message?: string, searchable?: boolean) => Promise<string | null>;
  confirm: (title: string, message: string, confirm?: string, cancel?: string) => Promise<boolean>;
  message: (title: string, message: string) => void;
};
const DialogContext = createContext<Dialogs | null>(null);

// @v2 _PreparationInputDialog
function DialogContent({ dialog, close }: { dialog: Dialog; close: () => void }) {
  const t = usePreparationText(), { width, height } = useWindowDimensions();
  const initial = dialog.kind === 'input' ? dialog.initial ?? '' : '';
  const nativeValue = useNativeState(initial);
  const searchValue = useNativeState('');
  const [value, setValue] = useState(initial), [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const cancel = () => { close(); if (dialog.kind === 'confirm') dialog.resolve(false); else if (dialog.kind === 'message') dialog.resolve(); else dialog.resolve(null); };
  const accept = () => {
    if (dialog.kind === 'input') {
      const issue = dialog.validate?.(value) ?? preparationInputError(value, dialog);
      if (issue) { setError(issue); return; }
      close(); dialog.resolve(value.trim());
    } else if (dialog.kind === 'confirm') { close(); dialog.resolve(true); }
    else if (dialog.kind === 'message') { close(); dialog.resolve(); }
  };
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={cancel}>
      <AlertDialog.Title><Text>{t(dialog.title)}</Text></AlertDialog.Title>
      <AlertDialog.Text>{dialog.kind === 'input' ? <Column verticalArrangement={{ spacedBy: 8 }}>
        <OutlinedTextField value={nativeValue} singleLine onValueChange={setValue}
          keyboardOptions={{ keyboardType: dialog.quantity ? 'decimal' : 'text' }} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label><Text>{t(dialog.label)}</Text></OutlinedTextField.Label>
        </OutlinedTextField>{error ? <Text>{t(error)}</Text> : null}</Column>
        : dialog.kind === 'choice' ? <Column>{dialog.message ? <Text>{dialog.message}</Text> : null}
          {dialog.searchable ? <OutlinedTextField value={searchValue} singleLine onValueChange={setSearch} modifiers={[fillMaxWidth()]}>
            <OutlinedTextField.Label><Text>{t('Qidirish')}</Text></OutlinedTextField.Label></OutlinedTextField> : null}
          <RNHostView matchContents><ScrollView style={{ maxHeight: height * 0.45, width: width * 0.7 }}>
          {dialog.choices.filter(item => `${item.label} ${item.subtitle ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())).map(item => <PreparationRow key={item.value} title={t(item.label)} subtitle={item.subtitle}
            disabled={item.disabled} onPress={() => { close(); dialog.resolve(item.value); }} />)}
        </ScrollView></RNHostView></Column> : <Text>{dialog.message}</Text>}</AlertDialog.Text>
      {dialog.kind !== 'message' && <AlertDialog.DismissButton><TextButton onClick={cancel}><Text>{t(dialog.kind === 'confirm' ? dialog.cancel : 'Bekor qilish')}</Text></TextButton></AlertDialog.DismissButton>}
      {dialog.kind !== 'choice' && <AlertDialog.ConfirmButton><TextButton onClick={accept}><Text>{t(dialog.kind === 'confirm' ? dialog.confirm : dialog.kind === 'message' ? 'OK' : 'Saqlash')}</Text></TextButton></AlertDialog.ConfirmButton>}
    </AlertDialog>
  </Host>;
}

export function PreparationDialogs({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const pending = useRef<Dialog | null>(null);
  useEffect(() => () => {
    const current = pending.current; pending.current = null;
    if (!current) return;
    if (current.kind === 'confirm') current.resolve(false);
    else if (current.kind === 'message') current.resolve();
    else current.resolve(null);
  }, []);
  const show = (next: Dialog) => { pending.current = next; setDialog(next); };
  const close = () => { pending.current = null; setDialog(null); };
  const value: Dialogs = {
    input: options => new Promise(resolve => show({ ...options, kind: 'input', resolve })),
    choose: (title, choices, message, searchable) => new Promise(resolve => show({ kind: 'choice', title, choices, message, searchable, resolve })),
    confirm: (title, message, confirm = 'Saqlash', cancel = 'Bekor qilish') => new Promise(resolve => show({ kind: 'confirm', title, message, confirm, cancel, resolve })),
    message: (title, message) => show({ kind: 'message', title, message, resolve: () => {} }),
  };
  return <DialogContext.Provider value={value}>{children}{dialog && <DialogContent key={dialog.kind + dialog.title} dialog={dialog} close={close} />}</DialogContext.Provider>;
}
export function usePreparationDialogs() {
  const value = useContext(DialogContext);
  if (!value) throw new Error('Preparation dialogs unavailable');
  return value;
}
