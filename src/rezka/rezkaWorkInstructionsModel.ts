import { apparatusUsesLaminationWorkflow, type AdminApparatus } from '../apparatusApi';
import type { RezkaSessionSnapshot } from './rezkaSessionGuard';

export type RezkaInstructionSection = { title: string; items: string[] };
export type RezkaApparatusGuide = { id: string; name: string; kind: string; sections: RezkaInstructionSection[] };
export type RezkaInstructionText = (key: string, values?: Record<string, unknown>) => string;
export type RezkaInstructionsScreenProps = { snapshot: RezkaSessionSnapshot;
  navigation?: { icon: 'menu' | 'back'; label: string; onPress(): void } | null };

/** @v2 _assignedApparatus */
export function assignedInstructionApparatus(rows: readonly AdminApparatus[], values: readonly string[]): AdminApparatus[] {
  const seen = new Set<string>();
  const ids = values.map(value => value.trim()).filter(value => {
    if (!value || seen.has(value.toLowerCase())) return false;
    seen.add(value.toLowerCase()); return true;
  });
  // V2 deduplicates case-insensitively but then matches the retained spelling exactly.
  return rows.filter(row => ids.includes(row.id.trim()));
}

function section(t: RezkaInstructionText, key: string, prefix: string, count: number): RezkaInstructionSection {
  return { title: t(key), items: Array.from({ length: count }, (_, index) => `${index + 1}. ${t(`${prefix}.${index + 1}`)}`) };
}

/** @v2 _ApparatusGuide */
export function rezkaApparatusGuide(row: AdminApparatus, t: RezkaInstructionText): RezkaApparatusGuide {
  const operation = row.operation.trim().toLowerCase();
  let prefix: string, kind: string, startCount = 3, pauseCount = 3;
  if (operation === 'print') {
    prefix = 'print'; startCount = 4;
    kind = row.technology.trim().toLowerCase() === 'flexographic' ? t('worker.guide.kind.print.flexo')
      : row.color_stations === null ? t('worker.guide.kind.machine') : t('worker.guide.kind.print.color', { count: row.color_stations });
  } else if (apparatusUsesLaminationWorkflow(row.operation)) {
    prefix = 'lamination'; kind = operation === 'glue' ? row.name : t('worker.guide.kind.lamination');
  } else if (operation === 'cut') {
    prefix = 'cutting'; kind = t('worker.guide.kind.cutting');
  } else {
    prefix = 'machine'; kind = t('worker.guide.kind.machine'); pauseCount = 2;
  }
  return { id: row.id, name: row.name, kind, sections: [
    section(t, 'worker.guide.before_start', `worker.guide.${prefix}.start`, startCount),
    section(t, 'worker.guide.pause', `worker.guide.${prefix}.pause`, pauseCount),
    section(t, 'worker.guide.complete', `worker.guide.${prefix}.complete`, 3),
    section(t, 'worker.guide.partial', 'worker.guide.partial', 3),
  ] };
}

export function rezkaWorkInstructionsContent(rows: readonly AdminApparatus[], t: RezkaInstructionText) {
  return { title: t('worker.instructions'), subtitle: t('worker.guide.subtitle'), intro: t('worker.guide.intro'),
    emptyTitle: t('worker.guide.no_machine.title'), emptyBody: t('worker.guide.no_machine.body'),
    common: [section(t, 'worker.guide.open_order', 'worker.guide.open_order', 5),
      section(t, 'worker.guide.states_actions', 'worker.guide.states_actions', 4)],
    guides: rows.map(row => rezkaApparatusGuide(row, t)) };
}
