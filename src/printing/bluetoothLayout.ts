/** @v2 bluetoothPrinterText */
export function bluetoothPrinterText(value: string): string {
  const substitutions: Record<string, string> = {
    А: 'A', Б: 'B', В: 'V', Г: 'G', Ғ: "G'", Д: 'D', Е: 'E', Ё: 'YO', Ж: 'J', З: 'Z', И: 'I', Й: 'Y',
    К: 'K', Қ: 'Q', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', У: 'U', Ў: "O'",
    Ф: 'F', Х: 'X', Ҳ: 'H', Ц: 'TS', Ч: 'CH', Ш: 'SH', Щ: 'SHCH', Ъ: '', Ь: '', Ы: 'Y', Э: 'E',
    Ю: 'YU', Я: 'YA', Ә: 'A', Ҷ: 'J', Җ: 'J', Ҡ: 'Q', Ң: 'N', Ө: 'O', Ү: 'U', Ұ: 'U', Һ: 'H',
    І: 'I', Ї: 'I', Є: 'E', Ґ: 'G', Ӣ: 'I', Ӯ: 'U',
  };
  const normalized = value.replace(/[‘’ʼʻ`\"]/g, "'").replace(/[\r\n\t]+/g, ' ').trim().toUpperCase();
  return Array.from(normalized, char => substitutions[char] ??
    (char.codePointAt(0)! >= 0x20 && char.codePointAt(0)! <= 0x7e ? char : '?')).join('').replace(/\s+/g, ' ');
}

function wrap(value: string, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of value.split(/\s+/).filter(Boolean)) {
    let rest = word;
    while (rest.length > width) {
      if (current) { lines.push(current); current = ''; }
      lines.push(rest.substring(0, width));
      rest = rest.substring(width);
    }
    const candidate = current ? `${current} ${rest}` : rest;
    if (candidate.length <= width) current = candidate;
    else { lines.push(current); current = rest; }
  }
  if (current) lines.push(current);
  return lines;
}

/** @v2 bluetoothMaterialSplitNameLines */
export function bluetoothMaterialSplitNameLines(itemName: string): string[] {
  const name = bluetoothPrinterText(itemName);
  return wrap(bluetoothPrinterText(`HOMASHYO: ${name || '-'}`), 24);
}

/** @v2 bluetoothMaterialProductNameLines */
export function bluetoothMaterialProductNameLines(itemName: string): string[] {
  const name = bluetoothPrinterText(itemName);
  return wrap(bluetoothPrinterText(`MAHSULOT: ${name || '-'}`), 28);
}

export type BluetoothProgressLine = { text: string; y: number; font: string; char_width: number };
export type BluetoothProgressLayout = { lines: BluetoothProgressLine[]; codeY: number; codeX: number };

/** @v2 buildBluetoothProgressLayout */
export function buildBluetoothProgressLayout(payload: Record<string, unknown>): BluetoothProgressLayout {
  const value = (key: string): string => String(payload[key] ?? '').trim();
  const rawProduct = value('item_name') || value('item_code');
  const customer = value('customer_name') || '-';
  const prefix = 'PEREMOTKA - ';
  const isPeremotka = rawProduct.startsWith(prefix);
  let product = isPeremotka ? rawProduct.substring(prefix.length) : rawProduct;
  for (const marker of [' YARIM TAYYOR MAHSULOT', ' YARIM TAYYOR', ' TAYYOR MAHSULOT', ', APPARAT:', ', REZKA HOLATDA']) {
    const index = product.indexOf(marker);
    if (index > 0) product = product.substring(0, index);
  }
  product = product.replace(/[ ,\-]+$/, '').trim() || rawProduct || '-';
  let apparatus = value('apparatus_display_name') || value('apparatus');
  if (!apparatus) {
    const marker = rawProduct.indexOf(', APPARAT:');
    if (marker >= 0) apparatus = rawProduct.substring(marker + ', APPARAT:'.length).split(',')[0].trim();
  }
  if (/^[789] TA RANGLI BOSMA(?: APARAT)?$/.test(apparatus)) apparatus = `${apparatus[0]}TALIK BOSMA`;
  if (!apparatus) apparatus = '-';
  const status = isPeremotka ? 'PEREMOTKA' : rawProduct.includes('YARIM TAYYOR') ? 'YARIM TAYYOR'
    : rawProduct.includes('TAYYOR') ? 'TAYYOR MAHSULOT' : 'YARIM TAYYOR';
  const gross = typeof payload.gross_qty === 'number' ? payload.gross_qty : 0;
  const tare = typeof payload.tare_kg === 'number' ? payload.tare_kg : 0;
  const includesBobina = payload.include_bobina_in_net === true;
  const net = includesBobina ? gross : Math.max(0, gross - tare);
  const progress = typeof payload.progress_qty === 'number' ? payload.progress_qty : net;
  const weightUnit = value('unit') || 'KG';
  const progressUnit = value('progress_unit') || 'M';
  const primary = [`APARAT: ${apparatus}`, `MAHSULOT NOMI: ${customer} - ${product}`,
    `METRAJ: ${progress.toFixed(2)} ${progressUnit}`, `NETTO: ${net.toFixed(2)} ${weightUnit}`,
    ...(!includesBobina ? [`BRUTTO: ${gross.toFixed(2)} ${weightUnit}`] : [])];
  const secondary = [`HOLAT: ${status}`, ...(value('completed_at_label') ? [`TUGATILDI: ${value('completed_at_label')}`] : []),
    `ISH KODI: ${value('order_code') || '-'}`];
  for (const size of [{ name: 'large', height: 24, width: 16 }, { name: 'medium', height: 20, width: 16 },
    { name: 'small', height: 12, width: 8 }]) {
    const lines: BluetoothProgressLine[] = [];
    let y = 12;
    const append = (fields: string[], font: string, height: number, charWidth: number) => {
      const columns = Math.trunc((560 - 8 - 12 - 1) / charWidth);
      for (const field of fields) {
        for (const line of wrap(field, columns)) {
          lines.push({ text: line, y, font, char_width: charWidth });
          y += height;
        }
        y += 3;
      }
    };
    append(primary, size.name, size.height, size.width);
    append(secondary, 'medium', 20, 16);
    y -= 3;
    if (y <= 240) return { lines, codeY: Math.max(236, y + 12), codeX: 84 };
  }
  throw new Error('WIP label matni 70 x 50 mm qog‘ozga sig‘madi');
}
