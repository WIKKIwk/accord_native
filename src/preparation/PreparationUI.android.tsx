import { AlertDialog, Button, Column, Host, OutlinedTextField, RNHostView, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { router, type Href } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { RoleFab, type RoleFabAction } from '../shared/navigation/RoleFab.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { preparationInputError, preparationQuantityInput } from './preparationLogic';

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

export function PreparationDock({ profile = false, chat = false }: { profile?: boolean; chat?: boolean }) {
  const insets = useSafeAreaInsets(), t = usePreparationText();
  const active = profile ? 'profile' : chat ? 'chat' : 'home';
  const items: RoleNavigationItem[] = [
    { id: 'home', label: t('Tayyorlov'), icon: 'home', testID: 'preparation-home' },
    { id: 'chat', label: t('Chat'), icon: 'chat_bubble', testID: 'preparation-chat' },
    { id: 'profile', label: t('Profil'), icon: 'person', testID: 'preparation-profile' },
  ];
  return <RoleBottomBar active={active} items={items} bottomInset={insets.bottom} onSelect={id => {
    if (id === active) return;
    if (id === 'home') router.dismissTo('/android-preparation' as Href);
    else if (id === 'chat') router.navigate('/android-preparation/chat' as Href);
    else if (id === 'profile') router.navigate('/android-preparation/profile' as Href);
  }} />;
}

export function PreparationPage({ title, subtitle, children, refreshing, onRefresh, root = false, drawer = false, fabActions, onFabSelect }: {
  title: string; subtitle?: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void; root?: boolean; drawer?: boolean;
  fabActions?: readonly RoleFabAction[]; onFabSelect?: (id: string) => void;
}) {
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), t = usePreparationText();
  const roleDrawer = useRoleDrawer();
  const [dockHeight, setDockHeight] = useState(80 + insets.bottom);
  const navigation = root && drawer ? { icon: 'menu' as const, label: t('Menyu'), onPress: roleDrawer.open, testID: 'preparation-menu' }
    : !root ? { icon: 'back' as const, label: t('Orqaga'), onPress: () => {
      if (router.canGoBack()) router.back(); else router.replace('/android-preparation' as Href);
    } } : undefined;
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <RoleHeader title={t(title)} subtitle={subtitle ? t(subtitle) : undefined} navigation={navigation} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
      {children}
    </ScrollView>
    <View onLayout={event => setDockHeight(event.nativeEvent.layout.height)}><PreparationDock /></View>
    {fabActions?.length && onFabSelect ? <RoleFab actions={fabActions} onSelect={onFabSelect} bottomOffset={dockHeight + 16}
      testIDPrefix="preparation-fab" openLabel={t('Amallarni ochish')} closeLabel={t('Amallarni yopish')} /> : null}
  </View>;
}

type Choice = { label: string; subtitle?: string; searchText?: string; value: string; disabled?: boolean };
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
        <OutlinedTextField value={nativeValue} singleLine onValueChange={text => {
          const next = dialog.quantity ? preparationQuantityInput(text) : text;
          if (next !== text) nativeValue.set(next); setValue(next);
        }}
          keyboardOptions={{ keyboardType: dialog.quantity ? 'decimal' : 'text' }} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label><Text>{t(dialog.label)}</Text></OutlinedTextField.Label>
        </OutlinedTextField>{error ? <Text>{t(error)}</Text> : null}</Column>
        : dialog.kind === 'choice' ? <Column>{dialog.message ? <Text>{dialog.message}</Text> : null}
          {dialog.searchable ? <OutlinedTextField value={searchValue} singleLine onValueChange={setSearch} modifiers={[fillMaxWidth()]}>
            <OutlinedTextField.Label><Text>{t('Qidirish')}</Text></OutlinedTextField.Label></OutlinedTextField> : null}
          <RNHostView matchContents><ScrollView style={{ maxHeight: height * 0.45, width: width * 0.7 }}>
          {dialog.choices.filter(item => `${item.label} ${item.subtitle ?? ''} ${item.searchText ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())).map(item => <PreparationRow key={item.value} title={t(item.label)} subtitle={item.subtitle}
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
