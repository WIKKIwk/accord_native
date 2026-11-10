export type WorkerSwitchChoice = 'temporary_pause' | 'complete' | null;
export type WorkerSwitchPromptProps = { apparatus: string; order: string; canComplete: boolean; onChoose(choice: WorkerSwitchChoice): void };
