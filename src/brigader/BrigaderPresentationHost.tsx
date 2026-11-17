import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { BrigaderDialog } from './BrigaderDialog';
import { BrigaderSheet } from './BrigaderSheet';
import { BrigaderPresentations, type BrigaderPresentation } from './brigaderPresentations';
function Presentation({ owner, entry, render, sheet, dismissible, options }: { owner: BrigaderPresentations; entry: BrigaderPresentation; render: PresentationHostProps['render']; sheet: boolean; dismissible: boolean; options?: Pick<import('./BrigaderDialogTypes').BrigaderDialogProps,'inset'|'maxWidth'|'fullScreen'> }) {
  const current = useCallback(() => owner.currentEntry(entry.id), [owner, entry.id]);
  const dismiss = useCallback(() => { if (dismissible) owner.close(entry.id); }, [owner, entry.id, dismissible]);
  const detached = useCallback(() => owner.detached(entry.id), [owner, entry.id]);
  const Surface = sheet ? BrigaderSheet : BrigaderDialog;
  return <Surface {...options} identity={entry.identity} current={current} closing={entry.closing} dismiss={dismiss} detached={detached} dismissible={dismissible}>{(interactive, shown) => render(entry, interactive, shown)}</Surface>;
}
type PresentationHostProps = { owner: BrigaderPresentations; render: (entry: BrigaderPresentation, interactive: () => boolean, shown: boolean) => ReactNode; options?: (entry: BrigaderPresentation) => Pick<import('./BrigaderDialogTypes').BrigaderDialogProps,'inset'|'maxWidth'|'fullScreen'>; filter?: (entry: BrigaderPresentation) => boolean; sheet?: (entry: BrigaderPresentation) => boolean; dismissible?: (entry: BrigaderPresentation) => boolean };
export function BrigaderPresentationHost(props: PresentationHostProps) {
  const entries = useSyncExternalStore(props.owner.subscribe, props.owner.getSnapshot, props.owner.getSnapshot);
  return <>{entries.filter(entry => !props.filter || props.filter(entry)).map(entry => <Presentation key={entry.id} owner={props.owner} entry={entry} render={props.render} options={props.options?.(entry)} sheet={props.sheet?.(entry) ?? false} dismissible={props.dismissible?.(entry) ?? true} />)}</>;
}
