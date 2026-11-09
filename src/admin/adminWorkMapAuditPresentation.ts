import { adminText, uiText } from '../shared/localization';
import { adminWorkMapAuditViolationText, type AdminWorkMapAuditReport } from './adminWorkMapAuditModel';

export type AdminWorkMapAuditPresentation = ReturnType<typeof adminWorkMapAuditPresentation>;
export function adminWorkMapAuditPresentation(report: AdminWorkMapAuditReport | null, error: string | null, loading: boolean, locale: string) {
  const t = (key: string, values?: Record<string, string | number>) => adminText(`production.${key}`, locale, values);
  return { title: t(report == null ? 'audit_title' : report.ok ? 'audit_clean' : 'audit_issues'), description: t('audit_description'),
    clean: report?.ok === true, loading, canRefresh: !loading, refreshLabel: t('refresh_audit'), error,
    initialProgress: report == null && error == null,
    counts: report == null ? [] : [
      { id: 'orders', label: t('orders'), value: report.checked_order_count },
      { id: 'batches', label: t('batches'), value: report.checked_batch_count },
      { id: 'sessions', label: t('sessions'), value: report.checked_session_count },
      { id: 'errors', label: t('errors'), value: report.total_violations ?? report.violations.length },
    ].map(count => ({ ...count, text: uiText(`${count.label}: ${count.value}`, locale) })),
    violations: (report?.violations ?? []).map((violation, index) => ({ key: String(index), title: adminWorkMapAuditViolationText(violation.code),
      subtitle: [violation.order_id ? t('audit_order', { value: violation.order_id }) : '', violation.subject ? t('audit_object', { value: violation.subject }) : ''].filter(Boolean).join(' • ') })),
    successTitle: report?.ok === true ? t('audit_success') : null, successDescription: report?.ok === true ? t('audit_success_description') : null };
}
