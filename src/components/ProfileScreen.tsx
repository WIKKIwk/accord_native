import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { AvatarUploadError, uploadProfileAvatar } from '../profileAvatarUpload';
import { initialProfileSnapshot, profileDisplay, profileSnapshotFromResponse } from '../profileModel';
import { ProfileNameError, updateProfileName } from '../profileNameUpdate';
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
  const [draftPhoto, setDraftPhoto] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const savingRef = useRef(false);
  const editorGeneration = useRef(0);
  const mounted = useRef(true);
  const readGeneration = useRef(0);
  const operationController = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operationController.current?.abort(); };
  }, []);

  useFocusEffect(useCallback(() => {
    if (busy.current) return;
    const controller = new AbortController();
    const generation = readGeneration.current;
    let active = true;
    void (async () => {
      try {
        const response = await authorizedFetch(session, '/v1/mobile/profile', { signal: controller.signal });
        if (!response.ok) return;
        const next = profileSnapshotFromResponse(session, await response.json());
        if (!active || generation !== readGeneration.current || !activeSessionToken(session) || !next) return;
        setSnapshot(next);
        setAvatarToken(activeSessionToken(session));
      } catch {
        // Keep the last known session details when the server is unavailable.
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [session]));

  const openEditor = useCallback(() => {
    if (busy.current || !activeSessionToken(session)) return;
    readGeneration.current++;
    editorGeneration.current++;
    setDraftName(profileDisplay(snapshot).name);
    setDraftPhoto(null);
    setEditing(true);
  }, [session, snapshot]);

  const closeEditor = useCallback(() => {
    if (savingRef.current) return;
    editorGeneration.current++;
    setEditing(false);
    setDraftPhoto(null);
  }, []);

  const choosePhoto = useCallback(async (source: AvatarSource) => {
    if (busy.current || !activeSessionToken(session)) return;
    busy.current = true;
    const generation = editorGeneration.current;
    try {
      let uri: string | undefined;
      if (source === 'file') {
        const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true, multiple: false, base64: false });
        if (!result.canceled) uri = result.assets[0]?.uri;
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
        if (!result.canceled) uri = result.assets[0]?.uri;
      }
      if (uri && mounted.current && generation === editorGeneration.current && activeSessionToken(session)) setDraftPhoto(uri);
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
    const name = draftName.trim();
    if (!name) { showError('Ism kiritilmagan', 'Profil uchun ism kiriting.'); return; }
    if (name === profileDisplay(snapshot).name && !draftPhoto) { closeEditor(); return; }

    busy.current = true;
    savingRef.current = true;
    readGeneration.current++;
    setIsBusy(true);
    setSaving(true);
    const controller = new AbortController();
    operationController.current = controller;
    let nameSaved = false;
    let step: 'name' | 'photo' = 'name';
    try {
      if (name !== profileDisplay(snapshot).name) {
        const next = await updateProfileName(session, name, controller.signal);
        if (!mounted.current || controller.signal.aborted || !activeSessionToken(session)) return;
        setSnapshot(next);
        setAvatarToken(activeSessionToken(session));
        nameSaved = true;
      }
      if (draftPhoto) {
        step = 'photo';
        const next = await uploadProfileAvatar(session, draftPhoto, controller.signal);
        if (!mounted.current || controller.signal.aborted || !activeSessionToken(session)) return;
        setSnapshot(next);
        setAvatarToken(activeSessionToken(session));
        setAvatarRevision((revision) => revision + 1);
      }
      setDraftPhoto(null);
      editorGeneration.current++;
      setEditing(false);
    } catch (error) {
      if (mounted.current && !controller.signal.aborted && activeSessionToken(session)) {
        const detail = error instanceof ProfileNameError || error instanceof AvatarUploadError
          ? error.message : 'Internetni tekshirib, qayta urinib ko‘ring.';
        showError('Saqlab bo‘lmadi', nameSaved && step === 'photo' ? `Ism saqlandi. Rasm: ${detail}` : detail);
      }
    } finally {
      if (operationController.current === controller) operationController.current = null;
      busy.current = false;
      savingRef.current = false;
      if (mounted.current) { setIsBusy(false); setSaving(false); }
    }
  }, [closeEditor, draftName, draftPhoto, session, snapshot]);

  return <ProfileView session={session} snapshot={snapshot} avatarToken={avatarToken} avatarRevision={avatarRevision}
    editing={editing} busy={isBusy} saving={saving} draftName={draftName} draftPhoto={draftPhoto}
    onOpenEditor={openEditor} onCloseEditor={closeEditor} onChangeName={setDraftName}
    onChoosePhoto={choosePhoto} onSave={save} onDailyWork={onDailyWork} onLogout={onLogout} />;
}
