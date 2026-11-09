const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('both native create-flow views connect the V2 screens and actions', () => {
  for (const platform of ['ios', 'android']) {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/supplier', `SupplierCreateScreens.${platform}.tsx`), 'utf8');
    for (const expected of [
      '@v2 SupplierItemPickerScreen', '@v2 SupplierQtyScreen', '@v2 SupplierConfirmScreen', '@v2 SupplierSuccessScreen',
      'Mahsulot tanlash', 'Nom bo‘yicha qidiring', 'Mahsulot topilmadi.', 'Bu supplierga item biriktirilmagan.',
      'Miqdor', 'Davom etish', 'Tasdiqlash', 'Ha, jo‘natishni saqlash', 'Orqaga qaytish', 'Saqlandi', 'Home ga qaytish',
      'props.onChoose(item)', 'supplierQuantity(quantity)', 'props.onContinue(qty)', 'controller.submit()',
      'submitting', 'props.onHome', 'props.footer',
    ]) assert.ok(source.includes(expected), `${platform}: ${expected}`);
  }
});
