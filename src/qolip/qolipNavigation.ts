import { extensionText, localizedGetter, productionText } from '../shared/localization';
export const qolipDestinations = [
  ['home', '', 'homeNavTitle', 'home', 'house'],
  ['blocks', 'blocks', 'nav.blocks', 'view_module', 'square.grid.3x3'],
  ['products', 'products', 'nav.molds', 'inventory_2', 'shippingbox'],
  ['checkouts', 'checkouts', 'nav.ledger', 'assignment_return', 'arrow.uturn.backward'],
  ['transfer', 'transfer', 'nav.transfer', 'swap_horiz', 'arrow.left.arrow.right'],
  ['sequence', 'sequence', 'nav.sequence', 'format_list_numbered', 'list.number'],
  ['tasks', 'tasks', 'nav.tasks', 'task_alt', 'checklist'],
  ['profile', 'profile', 'profileTitle', 'person', 'person'],
  ['product-transfer', 'product-transfer', 'product_transfer.title', 'drive_file_move', 'folder'],
  ['sets', 'sets', '@management', 'layers', 'square.3.layers.3d'],
  ['reworks', 'reworks', '@rework', 'build', 'wrench.and.screwdriver'],
  ['paddons', 'paddons', '@paddons', 'inventory_2', 'shippingbox'],
  ['archive', 'archive', '@archive', 'archive', 'archivebox'],
] as const;
export function qolipDestinationTitle(key: string, locale: string): string {
  if (key === 'homeNavTitle' || key === 'profileTitle') return localizedGetter(key, locale);
  if (key === '@management') return extensionText('qolipManagementText', 'title', locale);
  if (key === '@rework') return extensionText('qolipReworkText', 'title', locale);
  if (key === '@paddons' || key === '@archive') return extensionText('qolipStorageText', key.slice(1), locale);
  return productionText('qolip.' + key, locale);
}
