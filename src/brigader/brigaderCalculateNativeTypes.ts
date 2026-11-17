export type CalculateFieldProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    unit?: string;
    error?: string;
    disabled?: boolean;
    numeric?: boolean;
    integer?: boolean;
    multiline?: boolean;
    focusVersion?: number;
    autofocus?: boolean;
    maxLength?: number;
    selection?: number;
    selectionVersion?: number;
    onSelectionChange?: (selection: {
        start: number;
        end: number;
    }) => void;
    onSubmit?: () => void;
    minHeight?: number;
};
export type CalculatePickerProps = {
    label: string;
    value: string;
    onPress: () => void;
    disabled?: boolean;
    required?: boolean;
};
export type CalculateActionProps = {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    secondary?: boolean;
    height?: number;
};
export type CalculateFactsProps = {
    title: string;
    rows: {
        label: string;
        value: string;
        emphasized?: boolean;
    }[];
};
