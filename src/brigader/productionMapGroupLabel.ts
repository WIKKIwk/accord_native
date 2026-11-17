import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
export const productionGroupLabel = (key: string, locale = localeController.locale) => adminText(key === 'extrusion_lamination' ? 'apparatus.option.extruder_laminatsiya' : `apparatus.group.${key}`, locale);
