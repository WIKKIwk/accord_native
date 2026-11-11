import { router } from 'expo-router';
import { LoginScreen } from '../LoginScreen';
import { useAccountHome } from '../components/useAccountHome';

/** @v2 showAccountSwitcherSheet.onAddAccount */
export default function AddAccount() {
  const goHome = useAccountHome();
  return <LoginScreen addAccountMode onLogin={goHome} onBack={() => router.back()} />;
}
