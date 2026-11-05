/*
 * Derived from barcode 2.2.9 datamatrix.dart and reedsolomon.dart.
 * Copyright (C) 2020 David PHAM-VAN. Licensed under Apache License 2.0;
 * see licenses/barcode-2.2.9-LICENSE.txt. Translated to TypeScript.
 */

type Size = { side: number; regions: number; ecc: number; blocks: number };
const sizes: Size[] = [
  [10, 1, 5, 1], [12, 1, 7, 1], [14, 1, 10, 1], [16, 1, 12, 1], [18, 1, 14, 1],
  [20, 1, 18, 1], [22, 1, 20, 1], [24, 1, 24, 1], [26, 1, 28, 1], [32, 2, 36, 1],
  [36, 2, 42, 1], [40, 2, 48, 1], [44, 2, 56, 1], [48, 2, 68, 1], [52, 2, 84, 2],
  [64, 4, 112, 2], [72, 4, 144, 4], [80, 4, 192, 4], [88, 4, 224, 4], [96, 4, 272, 4],
  [104, 4, 336, 6], [120, 6, 408, 6], [132, 6, 496, 8], [144, 6, 620, 10],
].map(([side, regions, ecc, blocks]) => ({ side, regions, ecc, blocks }));

const exponent: number[] = [];
const logarithm: number[] = Array(256).fill(0);
let gf = 1;
for (let i = 0; i < 256; i++) {
  exponent[i] = gf;
  gf *= 2;
  if (gf >= 256) gf = (gf ^ 301) & 255;
}
for (let i = 0; i < 256; i++) logarithm[exponent[i]] = i;
const multiply = (a: number, b: number): number => a === 0 || b === 0 ? 0 : exponent[(logarithm[a] + logarithm[b]) % 255];
const polynomialProduct = (a: number[], b: number[]): number[] => {
  const result: number[] = Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) result[i + j] ^= multiply(a[i], b[j]);
  return result;
};
function errorCorrection(data: number[], count: number): number[] {
  let generator = [1];
  for (let i = 0; i < count; i++) generator = polynomialProduct(generator, [1, exponent[i + 1]]);
  const rest = [...data, ...Array<number>(count).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coefficient = rest[i];
    if (coefficient !== 0) for (let j = 0; j < generator.length; j++) rest[i + j] ^= multiply(generator[j], coefficient);
  }
  return rest.slice(data.length);
}

function encodedData(value: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < value.length;) {
    const char = value.charCodeAt(i++);
    const next = value.charCodeAt(i);
    if (char >= 48 && char <= 57 && next >= 48 && next <= 57) {
      bytes.push((char - 48) * 10 + next - 48 + 130); i++;
    } else if (char > 127) bytes.push(235, (char - 127) & 255);
    else bytes.push(char + 1);
  }
  return bytes;
}

function matrixFor(value: string): { pixels: boolean[]; side: number } {
  const data = encodedData(value);
  const size = sizes.find(s => ((s.side - 2 * s.regions) ** 2) / 8 - s.ecc >= data.length);
  if (!size) throw new Error('Too much data to encode');
  const matrixSide = size.side - 2 * size.regions;
  const dataCount = Math.trunc(matrixSide * matrixSide / 8) - size.ecc;
  if (data.length < dataCount) data.push(129);
  while (data.length < dataCount) data.push((129 + ((149 * (data.length + 1)) % 253) + 1) % 254);
  const stream = [...data, ...Array<number>(size.ecc).fill(0)];
  const eccPerBlock = size.ecc / size.blocks;
  for (let block = 0; block < size.blocks; block++) {
    const blockData: number[] = [];
    for (let i = block; i < data.length; i += size.blocks) blockData.push(data[i]);
    const ecc = errorCorrection(blockData, eccPerBlock);
    let j = 0;
    for (let i = block; i < size.ecc; i += size.blocks) stream[data.length + i] = ecc[j++];
  }
  const matrix: boolean[] = Array(matrixSide * matrixSide).fill(false);
  const occupied: boolean[] = Array(matrixSide * matrixSide).fill(false);
  const at = (row: number, col: number): boolean => occupied[col + row * matrixSide];
  const set = (rawRow: number, rawCol: number, byte: number, bit: number) => {
    let row = rawRow; let col = rawCol;
    if (row < 0) { row += matrixSide; col += 4 - ((matrixSide + 4) % 8); }
    if (col < 0) { col += matrixSide; row += 4 - ((matrixSide + 4) % 8); }
    const pos = col + row * matrixSide;
    occupied[pos] = true;
    matrix[pos] = ((byte >> (7 - bit)) & 1) === 1;
  };
  const place = (row: number, col: number, byte: number) => {
    [[-2,-2],[-2,-1],[-1,-2],[-1,-1],[-1,0],[0,-2],[0,-1],[0,0]]
      .forEach(([r,c], bit) => set(row + r, col + c, byte, bit));
  };
  const corner = (positions: number[][], byte: number) => positions.forEach(([r,c], bit) => set(r,c,byte,bit));
  let index = 0; let row = 4; let col = 0;
  while (row < matrixSide || col < matrixSide) {
    if (row === matrixSide && col === 0) corner([[matrixSide-1,0],[matrixSide-1,1],[matrixSide-1,2],[0,matrixSide-2],[0,matrixSide-1],[1,matrixSide-1],[2,matrixSide-1],[3,matrixSide-1]], stream[index++]);
    if (row === matrixSide-2 && col === 0 && matrixSide % 4 !== 0) corner([[matrixSide-3,0],[matrixSide-2,0],[matrixSide-1,0],[0,matrixSide-4],[0,matrixSide-3],[0,matrixSide-2],[0,matrixSide-1],[1,matrixSide-1]], stream[index++]);
    if (row === matrixSide-2 && col === 0 && matrixSide % 8 === 4) corner([[matrixSide-3,0],[matrixSide-2,0],[matrixSide-1,0],[0,matrixSide-2],[0,matrixSide-1],[1,matrixSide-1],[2,matrixSide-1],[3,matrixSide-1]], stream[index++]);
    if (row === matrixSide+4 && col === 2 && matrixSide % 8 === 0) corner([[matrixSide-1,0],[matrixSide-1,matrixSide-1],[0,matrixSide-3],[0,matrixSide-2],[0,matrixSide-1],[1,matrixSide-3],[1,matrixSide-2],[1,matrixSide-1]], stream[index++]);
    do {
      if (row < matrixSide && col >= 0 && !at(row,col)) place(row,col,stream[index++]);
      row -= 2; col += 2;
    } while (row >= 0 && col < matrixSide);
    row++; col += 3;
    do {
      if (row >= 0 && col < matrixSide && !at(row,col)) place(row,col,stream[index++]);
      row += 2; col -= 2;
    } while (row < matrixSide && col >= 0);
    row += 3; col++;
  }
  if (!at(matrixSide-1,matrixSide-1)) {
    set(matrixSide-1,matrixSide-1,255,0);
    set(matrixSide-2,matrixSide-2,255,0);
  }
  const pixels: boolean[] = Array(size.side * size.side).fill(false);
  const region = matrixSide / size.regions;
  const mark = (x: number, y: number, v: boolean) => { pixels[x + y * size.side] = v; };
  for (let y = 0; y < size.side; y += region + 2) for (let x = 0; x < size.side; x += 2) mark(x,y,true);
  for (let y = region + 1; y < size.side; y += region + 2) for (let x = 0; x < size.side; x++) mark(x,y,true);
  for (let x = region + 1; x < size.side; x += region + 2) for (let y = 1; y < size.side; y += 2) mark(x,y,true);
  for (let x = 0; x < size.side; x += region + 2) for (let y = 0; y < size.side; y++) mark(x,y,true);
  for (let hr = 0; hr < size.regions; hr++) for (let vr = 0; vr < size.regions; vr++)
    for (let x = 0; x < region; x++) for (let y = 0; y < region; y++)
      mark((region + 2) * hr + x + 1, (region + 2) * vr + y + 1, matrix[(region * hr + x) + (region * vr + y) * matrixSide]);
  return { pixels, side: size.side };
}

/** @v2 materialDataMatrixBars */
export function materialDataMatrixBars(epc: string): number[][] {
  const { pixels, side } = matrixFor(epc);
  const bars: number[][] = [];
  const edge = (x: number): number => Number(Math.max(0, Math.min(1, x)).toFixed(12));
  const pixel = 1 / side;
  for (let y = 0; y < side; y++) {
    let start = 0; let color = pixels[y * side];
    for (let x = 1; x <= side; x++) {
      if (x === side || pixels[y * side + x] !== color) {
        if (color) {
          const left = start * pixel; const top = y * pixel;
          bars.push([edge(left), edge(top), edge(left + (x - start) * pixel), edge(top + pixel)]);
        }
        color = pixels[y * side + x]; start = x;
      }
    }
  }
  return bars;
}
