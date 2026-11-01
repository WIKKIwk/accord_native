import type { Session } from '../auth';
import type { ProfileSnapshot } from '../profileModel';

export type AvatarSource = 'library' | 'camera' | 'file';

export type ProfileViewProps = {
  session: Session;
  snapshot: ProfileSnapshot;
  avatarToken: string | null;
  avatarRevision: number;
  editing: boolean;
  busy: boolean;
  saving: boolean;
  draftName: string;
  draftPhoto: string | null;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
  onChangeName: (name: string) => void;
  onChoosePhoto: (source: AvatarSource) => void;
  onSave: () => void;
  onDailyWork: () => void;
  onLogout: () => void;
};
