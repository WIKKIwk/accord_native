import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { extensionText } from '../shared/localization';
import { trimDart } from './qolipApiCommon';
import type { QolipProductPdfInput } from './qolipProductPdfModel';

/** Keep the source document metadata and actual page-number footer after native HTML pagination. */
export async function finishQolipProductPdf(bytes: Uint8Array, input: QolipProductPdfInput): Promise<Uint8Array> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const title = extensionText('qolipProductPdfText', 'title', input.locale), name = trimDart(input.productName) ? input.productName : input.productCode;
  document.setTitle(`${name} — ${title}`); document.setAuthor('Accord'); document.setCreator('Accord Mobile'); document.setSubject(`${title} · ${input.productCode}`);
  const font = await document.embedFont(StandardFonts.Helvetica), pages = document.getPages();
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index], label = `${index + 1} / ${pages.length}`;
    page.drawText(label, { x: page.getWidth() - 40 - font.widthOfTextAtSize(label, 8), y: 32, size: 8, font, color: rgb(101 / 255, 113 / 255, 133 / 255) });
  }
  return document.save();
}
