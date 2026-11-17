import { createContext, useContext, type ReactNode } from 'react';
import { useBrigaderPage } from './useBrigaderPage';

type Authority = { current: () => boolean; interactive: () => boolean; back: (result?: unknown) => void; args?: unknown };
const Context = createContext<Authority | null>(null);
export const BrigaderFeatureAuthority = Context.Provider;
export function useBrigaderFeature(route: string) {
  const page = useBrigaderPage(route), owned = useContext(Context);
  return owned ? { ...page, current: owned.current, interactive: owned.interactive, back: owned.back, args: owned.args } : { ...page, args: undefined as unknown };
}
export type BrigaderFeatureFrameProps = { route: string; title: string; children: ReactNode; actions?: ReactNode; footer?: ReactNode; drawer?: boolean; hideProfile?: boolean; onBack?: () => void;hideFooter?:boolean;backgroundColor?:string;foregroundColor?:string;plainBody?:boolean };
