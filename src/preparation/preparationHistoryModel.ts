import { preparationDisplay } from './preparationModel';

type HistoryEntry = Record<string, unknown>;
const text = (value: unknown) => value == null ? 'null' : String(value);
const decimal = (value: unknown) => preparationDisplay(value == null ? '0' : String(value));
const two = (value: number) => String(value).padStart(2, '0');

// @v2 _formatDateTime
export function preparationHistoryDate(raw: unknown): string {
  if (raw == null) return '';
  const source = String(raw);
  const match = /^([+-]?\d{4,6})-?(\d\d)-?(\d\d)(?:[ T](\d\d)(?::?(\d\d)(?::?(\d\d)(?:[.,](\d+))?)?)?( ?[zZ]| ?([-+])(\d\d)(?::?(\d\d))?)?)?$/.exec(source);
  if (!match) return source;
  const year = Number(match[1]), month = Number(match[2]) - 1, day = Number(match[3]);
  const hour = Number(match[4] ?? 0), second = Number(match[6] ?? 0);
  let minute = Number(match[5] ?? 0);
  if (match[9]) minute -= (match[9] === '-' ? -1 : 1) * (Number(match[10]) * 60 + Number(match[11] ?? 0));
  const date = new Date(0);
  if (match[8]) { date.setUTCFullYear(year, month, day); date.setUTCHours(hour, minute, second, 0); }
  else { date.setFullYear(year, month, day); date.setHours(hour, minute, second, 0); }
  if (!Number.isFinite(date.getTime())) return source;
  const localYear = date.getFullYear();
  const displayYear = localYear < 0 ? `-${String(-localYear).padStart(4, '0')}` : String(localYear).padStart(4, '0');
  return `${displayYear}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
}

// @v2 _linesSummary
export function preparationHistoryLines(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.map(entry => {
    const line = entry && typeof entry === 'object' ? entry as HistoryEntry : {};
    return `${line.name ?? ''}: ${decimal(line.percent)}% → ${decimal(line.kg)} kg`;
  }).join('\n');
}

export function preparationHistoryCard(doc: HistoryEntry) {
  const receipt = doc.kind === 'receipt', reversal = doc.kind === 'receipt_reversal';
  const title = receipt ? `Kirim — ${text(doc.name)}` : reversal ? `Kirimni bekor qilish — ${text(doc.name)}`
    : `Sarf — ${text(doc.order_code)} ${text(doc.order_title)}`;
  const detail = `${text(doc.warehouse)} • ${preparationHistoryDate(doc.created_at)}`;
  const subtitle = receipt || reversal ? `${detail}${doc.reversed === true ? '\nBekor qilingan' : ''}`
    : `${detail}\n${preparationHistoryLines(doc.lines)}`;
  const value = receipt ? `+${decimal(doc.kg)} kg` : reversal ? `-${decimal(doc.kg)} kg` : `Order: ${decimal(doc.order_kg)} kg`;
  return { title, subtitle, value };
}

export function preparationReceiptActionSubtitle(doc: HistoryEntry) {
  return `${doc.warehouse ?? ''} • ${decimal(doc.kg)} kg`;
}

export function preparationReceiptReverseMessage(doc: HistoryEntry) {
  return `${decimal(doc.kg)} kg kirim bekor qilinsinmi? Bu amal tarixda saqlanadi.`;
}

export function preparationMaterialReceiptCard(doc: HistoryEntry, materialName = '') {
  const reversal = doc.kind === 'receipt_reversal', reason = String(doc.reason ?? '').trim();
  const subtitle = [`${text(doc.warehouse)} • ${preparationHistoryDate(doc.created_at)}`,
    ...(reversal && reason ? [`Sabab: ${reason}`] : []),
    ...(!reversal && doc.reversed === true ? ['Bekor qilingan'] : [])].join('\n');
  return { title: reversal ? `Kirimni bekor qilish — ${doc.name ?? materialName}` : `+${decimal(doc.kg)} kg`,
    subtitle, value: reversal ? `-${decimal(doc.kg)} kg` : '' };
}

export function preparationMaterialConsumptionCard(doc: HistoryEntry, line: HistoryEntry) {
  return { title: `-${decimal(line.kg)} kg`,
    subtitle: `${text(doc.order_code)} ${text(doc.order_title)} • ${decimal(line.percent)}% • ${preparationHistoryDate(doc.created_at)}` };
}
