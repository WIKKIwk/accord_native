import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

type HomeSymbol = { ios: SFSymbol; android: AndroidSymbol };
// Native symbols for the finite V2 Material action vocabulary.
const symbols: Record<string, HomeSymbol> = {
  inventory_2_outlined: { ios: 'shippingbox', android: 'inventory_2' },
  grid_view_rounded: { ios: 'square.grid.2x2', android: 'grid_view' },
  warehouse_rounded: { ios: 'building.2', android: 'warehouse' },
  add_location_alt_outlined: { ios: 'mappin.and.ellipse', android: 'add_location_alt' },
  swap_horiz_rounded: { ios: 'arrow.left.arrow.right', android: 'swap_horiz' },
  account_tree_outlined: { ios: 'point.3.connected.trianglepath.dotted', android: 'account_tree' },
  group_add_outlined: { ios: 'person.badge.plus', android: 'group_add' },
  groups_outlined: { ios: 'person.3', android: 'groups' },
  admin_panel_settings_outlined: { ios: 'person.badge.shield.checkmark', android: 'admin_panel_settings' },
  telegram: { ios: 'paperplane', android: 'send' },
  list_alt_rounded: { ios: 'list.bullet.rectangle', android: 'list_alt' },
  straighten_rounded: { ios: 'ruler', android: 'straighten' },
  schema_rounded: { ios: 'point.3.connected.trianglepath.dotted', android: 'schema' },
  precision_manufacturing_rounded: { ios: 'gearshape.2', android: 'precision_manufacturing' },
  rule_rounded: { ios: 'checklist', android: 'rule' },
  scale_outlined: { ios: 'scalemass', android: 'scale' },
  settings_outlined: { ios: 'gearshape', android: 'settings' },
  tune_rounded: { ios: 'slider.horizontal.3', android: 'tune' },
  delete_sweep_outlined: { ios: 'trash', android: 'delete_sweep' },
  history_outlined: { ios: 'clock.arrow.circlepath', android: 'history' },
  monitor_heart_outlined: { ios: 'heart.text.square', android: 'monitor_heart' },
};
export function adminHomeSymbol(materialIcon: string): HomeSymbol {
  if (!Object.hasOwn(symbols, materialIcon)) throw new Error(`Unknown Admin home icon: ${materialIcon}`);
  return symbols[materialIcon];
}
