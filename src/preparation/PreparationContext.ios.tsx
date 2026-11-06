import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { registerSessionResetHook, type Session } from '../auth';
import { usePreparationHome } from './usePreparationHome';

type Home = ReturnType<typeof usePreparationHome>;
type Context = { session: Session; home: Home; onLogout: () => void; setChatClosing: (closing: boolean) => void };
const PreparationContext = createContext<Context | null>(null);

export function PreparationProvider({ session, onLogout, setChatClosing, children }: { session: Session; onLogout: () => void; setChatClosing: (closing: boolean) => void; children: ReactNode }) {
  const home = usePreparationHome(session);
  const [invalidated, setInvalidated] = useState(false);
  useEffect(() => registerSessionResetHook(async () => { setInvalidated(true); }), []);
  if (invalidated) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>Akkaunt o‘zgargan. Sahifani qayta oching</Text></View>;
  return <PreparationContext.Provider value={{ session, home, onLogout, setChatClosing }}>{children}</PreparationContext.Provider>;
}
export function usePreparationContext() {
  const value = useContext(PreparationContext);
  if (!value) throw new Error('Tayyorlov sessiyasi mavjud emas');
  return value;
}
