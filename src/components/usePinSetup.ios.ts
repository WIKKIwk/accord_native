import { useNativeState } from '@expo/ui/swift-ui';
import { useRef, useState } from 'react';
import { usePinSetupCore } from './usePinSetupCore';
import { useBaseLocale } from './useBaseLocale.ios';

export function usePinSetup() {
  const core = usePinSetupCore(useNativeState(''), useNativeState(''), useNativeState(''));
  const { text } = useBaseLocale();
  const [phase, setPhase] = useState<'entry' | 'confirm'>('entry');
  const [entry, setEntry] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [phaseError, setPhaseError] = useState('');
  const submitting = useRef(false);

  const clearFlow = () => { setEntry(''); setConfirmation(''); setPhase('entry'); setPhaseError(''); };
  const open = (mode: 'set' | 'remove') => { clearFlow(); core.open(mode); };
  const close = () => { if (!core.busy) { clearFlow(); core.close(); } };
  const change = (name: 'current' | 'pin' | 'repeat', value: string) => {
    const next = value.replace(/\D/g, '').slice(0, 4);
    if (next !== value) core[name].set(next);
    core.change(name, next);
    if (name === 'pin') setEntry(next);
    if (name === 'repeat') setConfirmation(next);
    setPhaseError('');
  };
  const next = () => { if (entry.trim().length === 4) { setPhase('confirm'); setPhaseError(''); } };
  const back = () => {
    if (core.busy) return;
    if (core.mode !== 'set' || phase === 'entry') { close(); return; }
    core.pin.set(''); core.repeat.set('');
    core.change('pin', ''); core.change('repeat', '');
    clearFlow();
  };
  const submit = async () => {
    if (submitting.current) return false;
    if (core.mode === 'set' && phase === 'confirm' && confirmation.trim() !== entry.trim()) {
      core.repeat.set(''); core.change('repeat', ''); setConfirmation(''); setPhaseError(text('pinMismatch'));
      return false;
    }
    if (core.mode === 'set' && phase !== 'confirm') return false;
    submitting.current = true;
    try {
      const saved = await core.submit();
      if (saved) clearFlow();
      else if (core.mode === 'set') {
        core.repeat.set(''); core.change('repeat', ''); setConfirmation(''); setPhaseError(text('pinSaveFailed'));
      }
      return saved;
    } finally {
      submitting.current = false;
    }
  };
  return { ...core, phase, phaseError, canNext: entry.trim().length === 4, change, open, close, next, back, submit };
}
