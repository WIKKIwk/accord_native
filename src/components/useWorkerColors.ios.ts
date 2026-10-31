import { useColorScheme } from 'react-native';

export function useWorkerColors() {
  const dark = useColorScheme() === 'dark';
  return dark
    ? { background: '#000000', surface: '#1c1c1e', field: '#2c2c2e', text: '#ffffff', muted: '#aeaeb2', icon: '#0a84ff', clear: '#aeaeb2' }
    : { background: '#ffffff', surface: '#ffffff', field: '#e5e5ea', text: '#1c1c1e', muted: '#6d6d72', icon: '#007aff', clear: '#8e8e93' };
}
