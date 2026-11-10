export type WorkerReportFieldProps = { label: string; value: string; change(value: string): void; decimal?: boolean; multiline?: boolean; disabled?: boolean; focus?: number };
export type WorkerFramePrintProps = { label: string; disabled: boolean; press(): void; longPress?(): void };
