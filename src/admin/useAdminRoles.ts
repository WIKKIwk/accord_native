import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { adminText, localizedGetter, localizedMethod } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminRolesScreenProps } from './AdminRolesTypes';
import { adminRolesSession } from './adminRolesSession';
import { adminRolesApparatusLabels, adminRolesAssignedRole, adminRolesAssignment, adminRolesAssignmentSubtitle, adminRolesCanAssign, adminRolesCapabilityLabel, adminRolesLabel,
  adminRolesNeedsApparatus, adminRolesPrincipals, adminRolesSummary } from './adminRolesModel';
import { dartTrim } from './dartJsonString';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function useAdminRoles(props: AdminRolesScreenProps) {
  const { session, witness, isCurrent, showTopNotice } = props;
  const owner = useMemo(() => adminRolesSession({ session, witness, isCurrent }), [session, witness, isCurrent]);
  const state = useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot);
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), shown = useRef<{ owner: typeof owner; serial: number } | null>(null);
  useEffect(() => {
    owner.controller.start(); const check = () => { if (!owner.current()) owner.controller.invalidate(); };
    const remove = subscribeSessionWitness(check); check(); return () => { remove(); owner.controller.stop(); };
  }, [owner]);
  useEffect(() => {
    const notice = state.notice;
    if (notice?.channel === 'top' && (shown.current?.owner !== owner || shown.current.serial !== notice.serial) && owner.current()) {
      shown.current = { owner, serial: notice.serial }; showTopNotice(localizedGetter(notice.key, locale), notice.tone, notice.icon);
    }
  }, [state.notice, owner, showTopNotice, locale]);
  const t = (key: string) => localizedGetter(key, locale), a = (key: string) => adminText(key, locale), m = (key: string, values: Record<string, unknown>) => localizedMethod(key, locale, values);
  const data = state.data, sheet = state.sheet;
  const roles = data?.roles.map(role => ({ role, label: adminRolesLabel(role, locale), summary: adminRolesSummary(role, locale), expanded: state.expandedRoleId === role.id,
    capabilityText: role.capability_codes.map(code => adminRolesCapabilityLabel(code, data.capabilities, locale)).join(', '), editable: !role.system })) ?? [];
  const principals = data ? adminRolesPrincipals(data, locale).map(principal => {
    const assigned = adminRolesAssignedRole(data, principal), labels = adminRolesApparatusLabels(adminRolesAssignment(data, principal), data);
    return { principal, subtitle: `${m('roleLabelForCode', { code: principal.role })} • ${principal.ref}`, assignedLabel: assigned ? adminRolesLabel(assigned, locale) : t('adminDefaultRole'),
      apparatusText: labels.length ? `${labels.length} ta aparat: ${labels.join(', ')}` : '' };
  }) : [];
  const options = sheet?.kind === 'assignment' ? sheet.data.roles.map(role => ({ role, label: adminRolesLabel(role, locale), subtitle: adminRolesAssignmentSubtitle(role, locale),
    enabled: adminRolesCanAssign(role, sheet.principal), apparatus: adminRolesNeedsApparatus(role) })) : [];
  return { state, current: owner.current() && state.valid, controller: owner.controller, t, a, m, roles, principals, options,
    canSaveEditor: sheet?.kind === 'editor' && !!dartTrim(sheet.label) && sheet.capabilities.length > 0 && !sheet.closing,
    capabilityLabel: (code: string) => adminRolesCapabilityLabel(code, sheet?.data.capabilities ?? [], locale),
    snackbar: state.notice?.channel === 'snackbar' ? { serial: state.notice.serial, message: a(state.notice.key) } : null };
}
export type AdminRolesScreenModel = ReturnType<typeof useAdminRoles>;
