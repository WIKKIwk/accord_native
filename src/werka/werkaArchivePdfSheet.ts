import { useRef } from 'react';
import { localizedGetter } from '../shared/localization';

export type WerkaArchivePdfAction = 'files' | 'photos' | 'share';
export type WerkaArchivePdfSheetProps = {
  locale: string;
  /** Remove this sheet synchronously from its owner. */
  onDismiss: () => void;
  /** The real owner must recheck session/file scope before starting an action. */
  onAction: (action: WerkaArchivePdfAction) => void;
};

export function werkaArchivePdfSheetLabels(locale: string) {
  return { title: localizedGetter('archivePdfReadyTitle', locale), message: localizedGetter('archivePdfReadyMessage', locale),
    files: localizedGetter('archiveSaveToFilesAction', locale), photos: localizedGetter('archiveSavePhotoAction', locale),
    share: localizedGetter('archiveShareAction', locale) };
}

/** One mounted sheet accepts only the first real dismissal or action event. */
export function useWerkaArchivePdfSheetEvents({ onDismiss, onAction }: WerkaArchivePdfSheetProps) {
  const finished = useRef(false);
  const dismiss = () => {
    if (finished.current) return;
    finished.current = true; onDismiss();
  };
  const choose = (action: WerkaArchivePdfAction) => {
    if (finished.current) return;
    finished.current = true; onDismiss(); onAction(action);
  };
  return { dismiss, choose };
}
