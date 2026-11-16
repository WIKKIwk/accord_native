export type ItemGroupsActionButtonProps = { label: string; onPress: () => void; disabled?: boolean };
export type ItemGroupsPickerFieldProps = { label: string; value: string | null; placeholder: string; enabled: boolean; onPress: () => void };
export type ItemGroupsTypeSwitchProps = { label: string; hint: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void };
