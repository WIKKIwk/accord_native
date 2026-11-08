/** Dart DateTime.parse's ISO subset and microsecond truncation, for V2 issue/history dates. */
export function rawSplitParseDateTime(raw: string): { date: Date; microsecond: number } {
  const match = /^([+-]?\d{4,6})-?(\d\d)-?(\d\d)(?:[ T](\d\d)(?::?(\d\d)(?::?(\d\d)(?:[.,](\d+))?)?)?( ?[zZ]| ?([-+])(\d\d)(?::?(\d\d))?)?)?$/.exec(raw);
  if (!match) throw new Error('Invalid date');
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const hour = Number(match[4] ?? 0), minute = Number(match[5] ?? 0), second = Number(match[6] ?? 0);
  const fraction = (match[7] ?? '').padEnd(6, '0').slice(0, 6);
  const milliseconds = Number(fraction.slice(0, 3)), microsecond = Number(fraction.slice(3, 6));
  const date = new Date(0);
  if (match[8] !== undefined) {
    const offset = match[9] === undefined ? 0 : (match[9] === '-' ? -1 : 1) * (Number(match[10]) * 60 + Number(match[11] ?? 0));
    date.setUTCFullYear(year, month - 1, day); date.setUTCHours(hour, minute - offset, second, milliseconds);
  } else {
    date.setFullYear(year, month - 1, day); date.setHours(hour, minute, second, milliseconds);
  }
  if (!Number.isFinite(date.getTime()) || (date.getTime() === 8640000000000000 && microsecond !== 0)) throw new Error('Invalid date');
  return { date, microsecond };
}

/** Dart DateTime.toLocal().toString() always prints milliseconds and prints extra microseconds only when nonzero. */
export function rawSplitLocalDateTime(date: Date, microsecond: number): string {
  const two = (value: number) => String(value).padStart(2, '0'), three = (value: number) => String(value).padStart(3, '0');
  const year = date.getFullYear(), y = `${year < 0 ? '-' : ''}${String(Math.abs(year)).padStart(4, '0')}`;
  return `${y}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}.` +
    `${three(date.getMilliseconds())}${microsecond === 0 ? '' : three(microsecond)}`;
}

const SCALE = 1000000n;
const MAXIMUM = 999999999999999999n;

type Json = Record<string, unknown>;
function object(value: unknown): Json {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid object');
  return value as Json;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid list');
  return value;
}
function required(row: Json, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Noto‘g‘ri javob: ${key}`);
  return value;
}
function optionalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new TypeError('Invalid string');
  return value;
}

/** @v2 rawSplitQuantity */
export function rawSplitQuantity(raw: string, allowZero = false): bigint {
  const value = raw.trim().replace(/,/g, '.');
  if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new Error('Son kiriting (ko‘pi bilan 6 kasr xona)');
  const [whole, fraction = ''] = value.split('.');
  const units = BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'));
  if (units > MAXIMUM || (!allowZero && units === 0n)) throw new Error('Miqdor ruxsat etilgan chegaradan tashqarida');
  return units;
}
/** @v2 rawSplitDecimal */
export function rawSplitDecimal(units: bigint): string {
  const abs = units < 0n ? -units : units;
  return `${units < 0n ? '-' : ''}${abs / SCALE}.${(abs % SCALE).toString().padStart(6, '0')}`;
}
/** @v2 rawSplitDifference */
export function rawSplitDifference(raw: string): bigint {
  if (!/^-?\d+(\.\d{1,6})?$/.test(raw)) throw new Error('Farq miqdori noto‘g‘ri');
  const [whole, fraction = ''] = raw.replace('-', '').split('.');
  const absolute = BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'));
  if (absolute > MAXIMUM * 2n) throw new Error('Farq chegaradan tashqarida');
  return raw.startsWith('-') ? -absolute : absolute;
}
/** @v2 rawSplitDisplay */
export function rawSplitDisplay(value: string): string {
  return rawSplitDecimal(rawSplitQuantity(value, true)).replace(/\.?0+$/, '');
}

/** @v2 RawSplitRoll */
export class RawSplitRoll {
  readonly stockId: string; readonly revision: string | null; readonly barcode: string; readonly warehouse: string;
  readonly itemCode: string; readonly itemName: string; readonly kg: string; readonly grossKg: string | null;
  readonly bobinaKg: string | null; readonly lengthM: string | null; readonly widthMm: string; readonly micron: string;
  constructor(value: unknown) {
    const row = object(value);
    this.stockId = required(row, 'stock_id'); this.revision = optionalString(row.revision);
    this.barcode = required(row, 'barcode'); this.warehouse = required(row, 'warehouse');
    this.itemCode = required(row, 'item_code'); this.itemName = required(row, 'item_name');
    this.kg = required(row, 'kg'); this.grossKg = optionalString(row.gross_kg); this.bobinaKg = optionalString(row.bobina_kg);
    this.lengthM = optionalString(row.length_m); this.widthMm = required(row, 'width_mm'); this.micron = required(row, 'micron');
    rawSplitQuantity(this.kg); rawSplitQuantity(this.widthMm); rawSplitQuantity(this.micron);
    if (this.lengthM !== null && this.lengthM.trim()) rawSplitQuantity(this.lengthM);
    if ((this.grossKg === null) !== (this.bobinaKg === null) || (this.grossKg !== null &&
      rawSplitQuantity(this.grossKg) - rawSplitQuantity(this.bobinaKg!, true) !== rawSplitQuantity(this.kg))) {
      throw new Error('Brutto, babina va netto hisobi noto‘g‘ri');
    }
  }
  get labelName(): string {
    const base = this.itemName.trim().replace(/\s*\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*$/, '');
    return `${base.trim()} ${rawSplitDisplay(this.widthMm)}/${rawSplitDisplay(this.micron)}`.trim();
  }
}

/** @v2 RawSplitResult */
export class RawSplitResult {
  readonly id: string; readonly source: RawSplitRoll; readonly sourceKg: string; readonly outputKg: string;
  readonly wasteKg: string; readonly issueId: string | null; readonly issueNote: string | null;
  readonly differenceKg: string; readonly createdAt: string | null; readonly outputs: RawSplitRoll[];
  constructor(value: unknown) {
    const row = object(value);
    this.id = required(row, 'id'); this.source = new RawSplitRoll(row.source);
    this.sourceKg = required(row, 'source_kg'); this.outputKg = required(row, 'output_kg'); this.wasteKg = required(row, 'waste_kg');
    this.issueId = optionalString(row.issue_id); this.issueNote = optionalString(row.issue_note);
    this.differenceKg = optionalString(row.difference_kg) ?? '0.000000'; this.createdAt = optionalString(row.created_at);
    this.outputs = list(row.outputs).map(output => new RawSplitRoll(output));
    const sum = this.outputs.reduce((a, b) => a + rawSplitQuantity(b.kg), 0n), difference = rawSplitDifference(this.differenceKg);
    if (!this.outputs.length || this.outputs.length > 100 || new Set(this.outputs.map(o => o.barcode)).size !== this.outputs.length ||
      new Set(this.outputs.map(o => o.stockId)).size !== this.outputs.length || rawSplitQuantity(this.source.kg) !== rawSplitQuantity(this.sourceKg) ||
      sum !== rawSplitQuantity(this.outputKg) || sum + rawSplitQuantity(this.wasteKg, true) + difference !== rawSplitQuantity(this.sourceKg) ||
      (this.issueId === null && difference !== 0n) || (this.issueId !== null && (!this.issueId || this.issueNote === null || !this.issueNote.trim())) ||
      this.outputs.some(o => o.stockId === this.source.stockId || o.barcode === this.source.barcode || o.itemCode !== this.source.itemCode ||
        o.warehouse !== this.source.warehouse || rawSplitQuantity(o.widthMm) > rawSplitQuantity(this.source.widthMm) ||
        rawSplitQuantity(o.micron) !== rawSplitQuantity(this.source.micron))) throw new Error('Bo‘lish natijasining hisobi noto‘g‘ri');
  }
  get differenceLabel(): string {
    const diff = rawSplitDifference(this.differenceKg), kg = rawSplitDecimal(diff < 0n ? -diff : diff).replace(/\.?0+$/, '');
    return diff === 0n ? 'Muammo izoh bilan qayd etilgan' : `${diff < 0n ? 'Izohli ortiqcha' : 'Izohli kamomad'}: ${kg} kg`;
  }
}

/** @v2 RawSplitWasteCheck */
export class RawSplitWasteCheck {
  readonly waste: bigint | null;
  constructor(readonly source: bigint, readonly output: bigint, enteredWaste: string) {
    try { this.waste = rawSplitQuantity(enteredWaste, true); } catch { this.waste = null; }
  }
  get difference(): bigint | null { return this.waste === null ? null : this.source - this.output - this.waste; }
  get kind(): string | null {
    return this.waste === null ? 'invalid_waste' : this.waste === 0n ? 'zero_waste' :
      this.difference! > 0n ? 'missing_weight' : this.difference! < 0n ? 'excess_weight' : null;
  }
  get message(): string {
    if (this.waste === null) return 'Atxot kg ni kiriting (0 dan katta, ko‘pi bilan 6 kasr xona).';
    const lines: string[] = [];
    if (this.waste === 0n) lines.push('Atxot 0 dan katta bo‘lishi kerak.');
    const delta = this.difference!, amount = rawSplitDecimal(delta < 0n ? -delta : delta).replace(/\.?0+$/, '');
    if (delta > 0n) lines.push(`${amount} kg hisobga olinmagan — yetishmayapti.`);
    if (delta < 0n) lines.push(`Asl vazndan ${amount} kg oshib ketdi.`);
    return lines.join('\n');
  }
}

/** @v2 RawSplitIssue */
export class RawSplitIssue {
  readonly id: string; readonly requestId: string; readonly source: RawSplitRoll; readonly note: string;
  readonly actorRef: string; readonly actorName: string; readonly createdAt: Date; readonly createdAtMicrosecond: number; readonly enteredWaste: string;
  readonly outputs: Json[]; readonly check: RawSplitWasteCheck;
  constructor(value: unknown) {
    const row = object(value);
    this.id = required(row, 'id'); this.requestId = required(row, 'request_id'); this.source = new RawSplitRoll(row.source);
    this.note = required(row, 'note'); this.actorRef = required(row, 'actor_ref'); this.actorName = required(row, 'actor_name');
    const created = rawSplitParseDateTime(required(row, 'created_at')); this.createdAt = created.date; this.createdAtMicrosecond = created.microsecond;
    if (typeof row.entered_waste_kg !== 'string') throw new TypeError('Invalid entered waste');
    this.enteredWaste = row.entered_waste_kg; this.outputs = list(row.outputs).map(value => ({ ...object(value) }));
    let sum = 0n;
    for (const output of this.outputs) {
      const net = rawSplitQuantity(required(output, 'kg'));
      if (rawSplitQuantity(required(output, 'gross_kg')) - rawSplitQuantity(required(output, 'bobina_kg'), true) !== net)
        throw new Error('Muammodagi netto hisobi noto‘g‘ri');
      rawSplitQuantity(required(output, 'width_mm')); sum += net;
    }
    this.check = new RawSplitWasteCheck(rawSplitQuantity(this.source.kg), sum, this.enteredWaste);
    const delta = this.check.difference, expected = delta === null ? null : rawSplitDecimal(delta);
    if (!this.outputs.length || this.outputs.length > 100 || this.check.kind === null || row.kind !== this.check.kind ||
      rawSplitQuantity(required(row, 'source_kg')) !== this.check.source || row.output_kg !== rawSplitDecimal(sum) ||
      (row.difference_kg ?? null) !== expected || (row.waste_kg ?? null) !== (this.check.waste === null ? null : rawSplitDecimal(this.check.waste))) {
      throw new Error('Muammo hisobining javobi noto‘g‘ri');
    }
  }
}

/** @v2 RawSplitSnapshot */
export class RawSplitSnapshot {
  readonly warehouses: string[]; readonly history: RawSplitResult[]; readonly issues: RawSplitIssue[];
  constructor(value: unknown) {
    const row = object(value); this.warehouses = list(row.warehouses).map(item => {
      if (typeof item !== 'string') throw new TypeError('Invalid warehouse'); return item;
    });
    this.history = list(row.history).map(item => new RawSplitResult(item));
    this.issues = list(row.issues ?? []).map(item => new RawSplitIssue(item));
  }
}
