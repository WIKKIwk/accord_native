import { Box, Button, CircularProgressIndicator, Column, Icon, IconButton, ListItem, OutlinedTextField, Row, Text, useNativeState } from '@expo/ui/jetpack-compose';
import { background, clickable, clip, fillMaxWidth, height, padding, semantics, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { savedAccountDisplayName, savedAccountSubtitle } from '../shared/accountEntryLogic';
import { BaseHost as Host } from './BaseHost';
import { useAccountSwitcher, type AccountSwitcherProps } from './useAccountSwitcher';
import { useBaseTheme } from './useBaseTheme';

/** @v2 AccountSwitcherSheet */
export function AccountSwitcher(props: AccountSwitcherProps) {
  const model = useAccountSwitcher(useNativeState(''), props), { colors } = useBaseTheme();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Column verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), padding(16, 12, 16, 24)]}>
      {model.target ? <>
        <IconButton onClick={model.back} enabled={!model.busy}
          modifiers={[testID('account-switch-back'), semantics({ contentDescription: model.text('closeAction') })]}>
          <Icon source={require('../../assets/icons/gscale/arrow_back.xml')} size={24} tint={colors.onSurface} />
        </IconButton>
        <Text color={colors.onSurface} style={{ fontSize: 22 }}>{model.pinPrompt}</Text>
        <OutlinedTextField value={model.field} enabled={!model.busy} singleLine maxLength={4} visualTransformation="password"
          keyboardOptions={{ keyboardType: 'numberPassword', imeAction: 'done' }} onValueChange={model.changePin}
          keyboardActions={{ onDone: value => { void model.verify(value); } }}
          colors={{ focusedTextColor: colors.onSurface, unfocusedTextColor: colors.onSurface,
            cursorColor: colors.primary, focusedLabelColor: colors.primary, unfocusedLabelColor: colors.onSurfaceVariant }}
          modifiers={[fillMaxWidth(), testID('account-switch-pin')]}>
          <OutlinedTextField.Label><Text>PIN</Text></OutlinedTextField.Label>
        </OutlinedTextField>
        <Button onClick={() => { void model.verify(model.field.get()); }} enabled={!model.busy} modifiers={[fillMaxWidth(), testID('account-switch-unlock')]}>
          <Text>{model.text(model.busy ? 'checking' : 'unlock')}</Text>
        </Button>
      </> : <>
        <Text color={colors.onSurface} style={{ fontSize: 24, fontWeight: '600' }}>{model.text('accountSwitchTitle')}</Text>
        {model.loading ? <CircularProgressIndicator /> : null}
        <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[fillMaxWidth(), clip({ type: 'roundedCorner', radius: 16 })]}>
          {model.accounts.map(account => {
            const current = account.id === model.activeId, name = savedAccountDisplayName(account);
            return <ListItem key={account.id} colors={{ containerColor: current ? colors.surfaceContainerHigh : colors.surfaceContainerLowest,
              contentColor: colors.onSurface, supportingContentColor: colors.onSurfaceVariant ?? colors.onSurface, trailingContentColor: colors.onSurface }}
              modifiers={[fillMaxWidth(), testID(`saved-account-${account.id}`),
                ...(!model.busy && !current ? [clickable(() => { void model.select(account); })] : [])]}>
              <ListItem.LeadingContent><Box contentAlignment="center" modifiers={[size(42, 42), clip({ type: 'circle' }), background(colors.secondaryContainer)]}>
                <Text color={colors.onSecondaryContainer} style={{ fontSize: 20, fontWeight: '600' }}>{name.charAt(0).toUpperCase() || '?'}</Text>
              </Box></ListItem.LeadingContent>
              <ListItem.HeadlineContent><Text color={colors.onSurface}
                style={{ fontSize: 18, fontWeight: '600' }}>{name}</Text></ListItem.HeadlineContent>
              <ListItem.SupportingContent><Text>{savedAccountSubtitle(account)}</Text></ListItem.SupportingContent>
              <ListItem.TrailingContent><Row><Text>{`${model.pins[account.id] ? '🔒 ' : ''}${current ? model.text('accountCurrent') : ''}`}</Text></Row></ListItem.TrailingContent>
            </ListItem>;
          })}
        </Column>
        <Button onClick={model.addAccount} enabled={model.ready && !model.busy} modifiers={[fillMaxWidth(), height(60), testID('account-switch-add')]}>
          <Text style={{ fontSize: 17, fontWeight: '600' }}>{model.text('accountAdd')}</Text>
        </Button>
      </>}
      {model.error ? <Text color={colors.error}>{model.error}</Text> : null}
    </Column>
  </Host>;
}
