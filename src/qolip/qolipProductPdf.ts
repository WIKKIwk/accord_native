import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { extensionText } from '../shared/localization';
import { qolipProductPdfFilename, qolipProductPdfHtml, type QolipProductPdfInput, type QolipProductPdfAssets } from './qolipProductPdfModel';
import { finishQolipProductPdf } from './qolipProductPdfMetadata';

let assets: Promise<QolipProductPdfAssets> | null = null;
function loadAssets(): Promise<QolipProductPdfAssets> {
  return assets ??= Promise.all([
    require('./assets/GoogleSans-Regular.ttf'), require('./assets/GoogleSans-Bold.ttf'),
    require('./assets/NotoNaskhArabic.ttf'), require('./assets/accord_pdf_wordmark.png'),
  ].map(async id => { const asset = await Asset.fromModule(id).downloadAsync(); if (!asset.localUri) throw new Error('PDF asset unavailable'); return new File(asset.localUri).base64(); }))
    .then(([regular, bold, arabic, logo]) => ({ regular, bold, arabic, logo })).catch(error => { assets = null; throw error; });
}

/** @v2 _QolipProductsScreenState._shareProductPdf */
export async function shareQolipProductPdf(input: QolipProductPdfInput, isCurrent: () => boolean): Promise<void> {
  if (!isCurrent()) return;
  const resources = await loadAssets(); if (!isCurrent()) return;
  const html = qolipProductPdfHtml(input, resources), result = await printToFileAsync({ html, width: 595.28, height: 841.89 });
  const source = new File(result.uri);
  if (!isCurrent()) { if (source.exists) source.delete(); return; }
  const bytes = await finishQolipProductPdf(await source.bytes(), input);
  if (!isCurrent()) { if (source.exists) source.delete(); return; }
  await source.write(bytes);
  if (!isCurrent()) { if (source.exists) source.delete(); return; }
  const output = new File(Paths.cache, qolipProductPdfFilename(input.productName, input.productCode));
  if (output.exists) output.delete(); source.move(output);
  if (!isCurrent()) { if (output.exists) output.delete(); return; }
  await shareAsync(output.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: extensionText('qolipProductPdfText', 'share', input.locale) });
}
