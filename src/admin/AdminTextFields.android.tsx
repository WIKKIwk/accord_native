import { BasicTextField, OutlinedTextField, type BasicTextFieldProps, type OutlinedTextFieldProps } from '@expo/ui/jetpack-compose';
import { useAdminFontsReady } from './AdminTypography.android';
import { adminInputTextStyle } from './adminInputFont.android';

function BasicField(props: BasicTextFieldProps) {
  const ready = useAdminFontsReady();
  return <BasicTextField {...props} textStyle={adminInputTextStyle(props.textStyle, ready)} />;
}
function OutlinedField(props: OutlinedTextFieldProps) {
  const ready = useAdminFontsReady();
  return <OutlinedTextField {...props} textStyle={adminInputTextStyle(props.textStyle, ready)} />;
}

// Reuse exact Expo slot identities; state, ref, callbacks and keyboard ownership
// stay with its original component and useCommonTextFieldProps implementation.
export const AdminBasicTextField = Object.assign(BasicField, {
  DecorationBox: BasicTextField.DecorationBox, InnerTextField: BasicTextField.InnerTextField, Placeholder: BasicTextField.Placeholder,
});
export const AdminOutlinedTextField = Object.assign(OutlinedField, {
  Label: OutlinedTextField.Label, Placeholder: OutlinedTextField.Placeholder, LeadingIcon: OutlinedTextField.LeadingIcon,
  TrailingIcon: OutlinedTextField.TrailingIcon, Prefix: OutlinedTextField.Prefix, Suffix: OutlinedTextField.Suffix, SupportingText: OutlinedTextField.SupportingText,
});
