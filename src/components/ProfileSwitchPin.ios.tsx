import { Button, SecureField, Section, Text } from '@expo/ui/swift-ui';
import { disabled, font, foregroundStyle, keyboardType } from '@expo/ui/swift-ui/modifiers';
import { useBaseLocale } from './useBaseLocale.ios';
import type { useSwitchPinSetup } from './useSwitchPinSetup.ios';

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

export function ProfileSwitchPin({ pin }: { pin: ReturnType<typeof useSwitchPinSetup> }) {
  const { text } = useBaseLocale();
  return <Section title={text('switchPinTitle')}>
    {!pin.stage ? <>
      <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>{text('switchPinBody')}</Text>
      <Button label={text(pin.hasPin ? 'switchPinChange' : 'switchPinSet')} onPress={pin.open}
        modifiers={[disabled(pin.busy || pin.hasPin === null)]} />
      {pin.hasPin ? <Button label={text('switchPinRemove')} onPress={() => { void pin.remove(); }}
        modifiers={[disabled(pin.busy)]} /> : null}
    </> : <>
      <Text>{text(pin.stage === 'entry' ? 'switchPinEnterTitle' : 'switchPinRepeatTitle')}</Text>
      <SecureField text={pin.field} maxLength={4} placeholder="PIN" onTextChange={pin.change}
        modifiers={[keyboardType('ascii-capable-number-pad'), disabled(pin.busy)]} />
      {pin.error ? <Text>{pin.error}</Text> : null}
      <Button label={pin.busy ? 'Tekshirilmoqda...' : text(pin.stage === 'entry' ? 'nextItemAction' : 'save')}
        onPress={() => { void pin.submit(); }} modifiers={[disabled(pin.busy)]} />
      <Button label={text('closeAction')} onPress={pin.back} modifiers={[disabled(pin.busy)]} />
    </>}
  </Section>;
}
