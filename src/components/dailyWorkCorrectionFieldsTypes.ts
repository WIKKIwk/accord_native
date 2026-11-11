import type { DailyWorkCorrectionController } from '../dailyWorkCorrection';

export type DailyWorkCorrectionFieldsProps = {
  edit: NonNullable<ReturnType<DailyWorkCorrectionController['getSnapshot']>['edit']>;
  controller: Pick<DailyWorkCorrectionController, 'change' | 'reason'>;
};
