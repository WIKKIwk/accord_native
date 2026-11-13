import { ProfileScreen } from '../components/ProfileScreen';
import { useMetalayzerContext } from './MetalayzerContext';
import { MetalayzerFrame } from './MetalayzerFrame.android';

export function MetalayzerProfile() {
  const { session, onLogout, isCurrent } = useMetalayzerContext();
  return <MetalayzerFrame title="Profil" profile><ProfileScreen session={session} onLogout={onLogout} isCurrent={isCurrent} /></MetalayzerFrame>;
}
