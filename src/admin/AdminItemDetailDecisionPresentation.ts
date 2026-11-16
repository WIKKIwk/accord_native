import type { AdminItemDetailDecisionKind, AdminItemDetailDecisionViewport } from './AdminItemDetailDecisionContentTypes';
import { adminItemDetailSameGroup, adminItemDetailVisibleGroups } from './adminItemDetailGroupModel';
import type { AdminItemDetailDecisionDialog } from './adminItemDetailDecisionController';
import { dartTrim } from './dartJsonString';

/** The real host supplies this Source kind/chrome. These are layout instructions, never a ready/close receipt. */
export function adminItemDetailDecisionSurface(kind: AdminItemDetailDecisionKind) {
  if (!['edit', 'delete', 'group', 'customers'].includes(kind)) throw TypeError('Original Source decision kind is required');
  const sheet = kind === 'group' || kind === 'customers';
  return Object.freeze({ kind: sheet ? 'bottom-sheet' as const : 'dialog' as const, barrierDismissible: true, barrierOpacity: .54,
    useSafeArea: kind !== 'group', isScrollControlled: sheet, showDragHandle: sheet, enableDrag: sheet,
    heightFraction: kind === 'group' ? .74 : kind === 'customers' ? .84 : null,
    contentWidth: kind === 'edit' ? 420 : null,
    // Source default AlertDialog inset; platform-native dialog chrome remains the real host's responsibility.
    dialogHorizontalInset: sheet ? null : 40,
    dialogVerticalInset: sheet ? null : 24, dialogMinimumWidth: sheet ? null : 280,
  });
}
export function adminItemDetailDecisionViewport(value: AdminItemDetailDecisionViewport | null): AdminItemDetailDecisionViewport | null {
  if (value === null) return null;
  if (!value || !Number.isFinite(value.width) || value.width <= 0 || !Number.isFinite(value.height) || value.height <= 0 || !Number.isFinite(value.paddingBottom) || value.paddingBottom < 0) throw TypeError('Original native surface viewport facts are required');
  return Object.freeze({ width: value.width, height: value.height, paddingBottom: value.paddingBottom });
}
export function adminItemDetailDeleteValues(dialog: Extract<AdminItemDetailDecisionDialog, { kind: 'delete' }>) {
  return Object.freeze({ name: dartTrim(dialog.detail.name) || dartTrim(dialog.detail.code), code: dialog.detail.code });
}
export function adminItemDetailDecisionGroups(dialog: Extract<AdminItemDetailDecisionDialog, { kind: 'group' }>) {
  return adminItemDetailVisibleGroups(dialog.groups, dialog.query).map(group => Object.freeze({ value: group, selected: adminItemDetailSameGroup(group, dialog.selected) }));
}
