import { WorkerControlException } from '../workerControlsApi';
import { preparationDecimal, preparationDecimalText, preparationDisplay } from './preparationModel';

export function preparationShareIntroduction(materialName: string) {
  return `${materialName || 'Homashyo'}: shnek ulushlari jami 100% bo‘lsin. Har bir shnek ichidagi seriyolar alohida 100% hisoblanadi.`;
}

export function preparationShareSummary(values: readonly string[]) {
  try {
    const total = values.reduce((sum, value) => {
      const parsed = preparationDecimal(value);
      if (parsed > 100000000n) throw new Error();
      return sum + parsed;
    }, 0n);
    return { valid: total === 100000000n, total: preparationDisplay(preparationDecimalText(total)) };
  } catch { return { valid: false, total: null }; }
}

export function preparationShareErrorMessage(error: unknown) {
  return error instanceof WorkerControlException ? error.message : 'Shnek ulushlari saqlanmadi. Qayta urinib ko‘ring';
}
