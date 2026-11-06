import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { AvatarUploadError, uploadProfileAvatar } from '../profileAvatarUpload';
import { initialProfileSnapshot, profileDisplay, profileSnapshotFromResponse } from '../profileModel';
import { updateProfileName } from '../profileNameUpdate';
import { profile } from '../profileApi';
import { profileNickname, saveProfileChanges } from '../shared/profileEditing';
import { ProfileView } from './ProfileView';
import type { AvatarSource } from './profileViewTypes';

type Props = { session: Session; onLogout: () => void; onDailyWork: () => void };

function showError(title: string, message: string) {
  if (Platform.OS === 'web') globalThis.alert(`${title}. ${message}`);
  else Alert.alert(title, message);
}

export function ProfileScreen(props: Props) {
  return <ProfileContent key={props.session.imageCacheScope} {...props} />;
}

function ProfileContent({ session, onLogout, onDailyWork }: Props) {
  const [snapshot, setSnapshot] = useState(() => initialProfileSnapshot(session));
  const [avatarToken, setAvatarToken] = useState(() => activeSessionToken(session));
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftPhoto, setDraftPhoto] = useState<{ uri: string; filename?: string } | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; filename?: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const savingRef = useRef(false);
  const editorGeneration = useRef(0);
  const mounted = useRef(true);
  const readGeneration = useRef(0);
  const operationController = useRef<AbortController | null>(null);
  const refreshingRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operationController.current?.abort(); };
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current || refreshingRef.current || !activeSessionToken(session)) return;
    refreshingRef.current = true;
    setRefreshing(true);
    const generation = readGeneration.current;
    try {
      const next = profileSnapshotFromResponse(session, await profile(session));
      if (!mounted.current || generation !== readGeneration.current || !activeSessionToken(session) || !next) return;
      setSnapshot(next);
      setAvatarToken(activeSessionToken(session));
    } catch { /* Keep the last known profile when refresh fails. */ }
    finally { refreshingRef.current = false; if (mounted.current) setRefreshing(false); }
  }, [session]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => listener.remove();
  }, [refresh]);

  const openEditor = useCallback(() => {
    if (busy.current || !activeSessionToken(session)) return;
    readGeneration.current++;
    editorGeneration.current++;
    setDraftName(profileDisplay(snapshot).name);
    setDraftPhoto(pendingPhoto);
    setEditing(true);
  }, [pendingPhoto, session, snapshot]);

  const closeEditor = useCallback(() => {
    if (savingRef.current && Platform.OS !== 'android') return;
    editorGeneration.current++;
    setEditing(false);
    setDraftPhoto(pendingPhoto);
  }, [pendingPhoto]);

  const choosePhoto = useCallback(async (source: AvatarSource) => {
    if (busy.current || !activeSessionToken(session)) return;
    busy.current = true;
    const generation = editorGeneration.current;
    try {
      let uri: string | undefined, filename: string | undefined;
      if (source === 'file') {
        const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true, multiple: false, base64: false });
        if (!result.canceled) { uri = result.assets[0]?.uri; filename = result.assets[0]?.name; }
      } else {
        if (source === 'camera' && Platform.OS !== 'web') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) throw new AvatarUploadError('Kameradan foydalanishga ruxsat bering.');
        }
        // The iOS library uses the modern picker and copies the photo without re-encoding it.
        const options: ImagePicker.ImagePickerOptions = source === 'library'
          ? { mediaTypes: ['images'], allowsEditing: false, quality: 1, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current }
          : { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.82 };
        const result = source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
        if (!result.canceled) { uri = result.assets[0]?.uri; filename = result.assets[0]?.fileName ?? undefined; }
      }
      if (uri && mounted.current && generation === editorGeneration.current && activeSessionToken(session)) setDraftPhoto({ uri, filename });
    } catch (error) {
      if (mounted.current && generation === editorGeneration.current && activeSessionToken(session)) {
        showError('Rasm tanlanmadi', error instanceof AvatarUploadError ? error.message : 'Boshqa rasm tanlab, qayta urinib ko‘ring.');
      }
    } finally {
      busy.current = false;
    }
  }, [session]);

  const save = useCallback(async () => {
    if (busy.current || !activeSessionToken(session)) return;
    const name = profileNickname(draftName, profileDisplay(snapshot).name);
    if (name === profileDisplay(snapshot).name && !draftPhoto) { closeEditor(); return; }

    busy.current = true;
    savingRef.current = true;
    readGeneration.current++;
    setIsBusy(true);
    setSaving(true);
    const controller = new AbortController();
    operationController.current = controller;
    setPendingPhoto(draftPhoto);
    editorGeneration.current++;
    setEditing(false);
    try {
      const active = () => mounted.current && !controller.signal.aborted && !!activeSessionToken(session);
      const error = await saveProfileChanges(name !== profileDisplay(snapshot).name ? async () => {
        const next = await updateProfileName(session, name, controller.signal);
        if (active()) { setSnapshot(next); setAvatarToken(activeSessionToken(session)); }
      } : null, draftPhoto ? async () => {
        const next = await uploadProfileAvatar(session, draftPhoto.uri, controller.signal, draftPhoto.filename);
        if (active()) {
          setSnapshot(next); setAvatarToken(activeSessionToken(session));
          setAvatarRevision(revision => revision + 1); setPendingPhoto(null); setDraftPhoto(null);
        }
      } : null, active);
      if (error && active()) showError('Saqlab bo‘lmadi', error === 'nickname' ? 'Ismni saqlab bo‘lmadi.' : 'Rasmni saqlab bo‘lmadi.');
    } finally {
      if (operationController.current === controller) operationController.current = null;
      busy.current = false;
      savingRef.current = false;
      if (mounted.current) { setIsBusy(false); setSaving(false); }
    }
  }, [closeEditor, draftName, draftPhoto, session, snapshot]);

  return <ProfileView session={session} snapshot={snapshot} avatarToken={avatarToken} avatarRevision={avatarRevision}
    editing={editing} busy={isBusy} saving={saving} refreshing={refreshing} onRefresh={refresh} draftName={draftName} draftPhoto={draftPhoto?.uri ?? null}
    onOpenEditor={openEditor} onCloseEditor={closeEditor} onChangeName={setDraftName}
    onChoosePhoto={choosePhoto} onSave={save} onDailyWork={onDailyWork} onLogout={onLogout} />;
}
