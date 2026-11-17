import { extensionText, localizedMethod } from '../shared/localization';
import type { QolipCatalogProduct } from './qolipProductsState';
import { trimDart } from './qolipApiCommon';
export type QolipProductPdfInput = { productCode: string; productName: string; molds: readonly QolipCatalogProduct[]; locale: string; exportedAt?: Date };
export type QolipProductPdfAssets = { regular: string; bold: string; arabic: string; logo: string };
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** @v2 QolipProductPdf.filename */
export function qolipProductPdfFilename(productName: string, productCode: string): string {
  const raw = trimDart(productName) ? productName : productCode;
  const stem = [...raw.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\s+/g, '-').replace(/^[.\-]+|[.\-]+$/g, '')].slice(0, 80).join('');
  return `qoliplar-${stem || 'mahsulot'}.pdf`;
}

/** @v2 QolipProductPdf.build */
export function qolipProductPdfHtml(input: QolipProductPdfInput, assets: QolipProductPdfAssets): string {
  const { productCode: code, productName, molds, locale } = input;
  if (!trimDart(code) || !molds.length || molds.some(mold => !trimDart(mold.qolip_code) || trimDart(mold.code).toLowerCase() !== trimDart(code).toLowerCase())) throw new TypeError('Expected molds for one exact catalog product');
  const t = (key: string) => extensionText('qolipProductPdfText', key, locale), title = t('title'), name = trimDart(productName) ? productName : code;
  const date = input.exportedAt ?? new Date(), two = (number: number) => String(number).padStart(2, '0');
  const timestamp = `${two(date.getUTCDate())}.${two(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}  ${two(date.getUTCHours())}:${two(date.getUTCMinutes())} UTC`;
  const groups = new Map<string, QolipCatalogProduct[]>();
  for (const mold of molds.filter(row => !row.is_extension).sort((a, b) => compare(a.set_id, b.set_id) || compare(a.qolip_code, b.qolip_code))) {
    const group = groups.get(mold.set_id); if (group) group.push(mold); else groups.set(mold.set_id, [mold]);
  }
  const sections: { id: string | null; molds: readonly QolipCatalogProduct[] }[] = [...groups].map(([id, molds]) => ({ id, molds }));
  const extensions = molds.filter(row => row.is_extension).sort((a, b) => compare(a.qolip_code, b.qolip_code)); if (extensions.length) sections.push({ id: null, molds: extensions });
  let number = 0;
  const content = sections.map(section => `<section><h2>${escape(section.id === null ? t('additional') : `${t('set_id')}: ${section.id}`)}</h2><table><thead><tr><th>#</th><th>${escape(t('code'))}</th><th>${escape(t('size'))}</th><th>${escape(t('color'))}</th></tr></thead><tbody>${section.molds.map(mold => `<tr><td dir="ltr">${++number}</td><td class="code" dir="ltr">${escape(mold.qolip_code)}</td><td dir="ltr">${mold.size > 0 ? mold.size : '—'}</td><td>${escape(trimDart(mold.color) ? localizedMethod('qolipColorName', locale, { raw: mold.color }) : '—')}</td></tr>`).join('')}</tbody></table></section>`).join('');
  return `<!DOCTYPE html><html lang="${escape(locale)}" dir="${locale === 'ur' ? 'rtl' : 'ltr'}"><head><meta charset="UTF-8"><title>${escape(`${name} — ${title}`)}</title><meta name="author" content="Accord"><meta name="creator" content="Accord Mobile"><meta name="subject" content="${escape(`${title} · ${code}`)}"><style>   @font-face{font-family:Accord;src:url(data:font/ttf;base64,${assets.regular})} @font-face{font-family:Accord;src:url(data:font/ttf;base64,${assets.bold});font-weight:bold} @font-face{font-family:Arabic;src:url(data:font/ttf;base64,${assets.arabic})}   @page{size:A4;margin:88pt 40pt 52pt} *{box-sizing:border-box} body{margin:0;font-family:${locale === 'ur' ? 'Arabic,Accord' : 'Accord,Arabic'},sans-serif;color:#24354D;font-size:10pt}header{position:fixed;top:-56pt;left:0;right:0;display:flex;direction:ltr;align-items:center;justify-content:space-between;border-bottom:.6pt solid #DCE1E8;padding-bottom:18pt}header img{width:112pt;height:38pt;object-fit:contain}header div{text-align:right}header strong{font-size:9pt}header p{font-size:8pt;color:#657185;margin:5pt 0 0}h1{font-size:21pt;margin:24pt 0 16pt}dl{display:flex;gap:28pt;margin:0 0 28pt}dt{font-size:8pt;color:#657185}dd{font-weight:bold;margin:4pt 0 0}section{break-inside:auto;margin-bottom:20pt}h2{font-size:8pt;font-weight:normal;color:#657185;margin:0 0 8pt;break-after:avoid}table{border-collapse:collapse;width:100%;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid}th{font-size:8pt;color:#657185;background:#F3F5F8;text-align:start}th,td{padding:9pt 10pt;border-bottom:.5pt solid #DCE1E8;vertical-align:middle;overflow-wrap:anywhere}th:first-child{width:${24 + String(molds.length).length * 6}pt}th:nth-child(2){width:42%}th:nth-child(3){width:17%}.code{font-family:Accord;font-weight:bold}footer{position:fixed;bottom:-20pt;left:0;right:0;margin-top:10pt;padding-top:10pt;border-top:.5pt solid #DCE1E8;font-size:8pt;color:#657185;direction:ltr}   </style></head><body><header><img alt="Accord" src="data:image/png;base64,${assets.logo}"><div><strong>${escape(title)}</strong><p>${timestamp}</p></div></header><h1>${escape(name)}</h1><dl><div><dt>${escape(t('product_code'))}</dt><dd dir="ltr">${escape(code)}</dd></div><div><dt>${escape(t('total'))}</dt><dd>${molds.length}</dd></div></dl>${content}<footer>Accord MES · ${escape(code)}</footer></body></html>`;
}
