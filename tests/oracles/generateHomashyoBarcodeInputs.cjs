// Deterministic inputs for the isolated f119 Dart barcode oracle.
const fixed = ["Milano Premium 30/40", " parent ", "https://example.test/path?barcode=A&barcode=B", "https://example.test/path?barcode=A&barcode=&epc=EPC", "https://example.test/path?epc=A&epc=B", "https://example.test/path?barcode=%FF&epc=EPC", "https://example.test/path?barcode=%E0%A4%A", "https://example.test/a%FF", "https://example.test/a%2Fb", "https://example.test/a+b", "https://example.test/path?barcode=a+b", "https://example.test/path?barcode=%20&epc=EPC", "https://example.test/a/../B", "http://example.test", "foo://example.test/a", "//example.test/a", "https://user:pass@example.test/a", "https://example.test/a?%62arcode=x", "https://example.test/a?BARCODE=A", "https://example.test/a?barcode=first&barcode=second&barcode=third", "https://example.test/a?barcode=A%00B", "https://example.test/a?barcode=%C0%AF", "https://example.test/a?barcode=%ZZ", "https://example.test/a/%E2%80%8B", "https://example.test/a/%F0%9F%93%A6", "https://example.test/%20", "https://example.test/a/", "https://example.test/a?qr=1&qr=2", "https://example.test/a?barcode=&qr=Q"];
const extra = ["https:foo", "http:////example.test/a", "https://example.test:99999/a", "https://EXAMPLE.test/a", "https://user@EXAMPLE.test/a", "https://[::1]/a", "https://example.test/a/../B", "https://example.test/a/%2E%2E/B", "https://example.test/%2F", "https://example.test/%252F", "https://example.test/a/%FF/b?qr=Q", "https://example.test/a/%FF/b", "https://example.test/a?unknown=%FF&barcode=B", "https://example.test/a?barcode=B&unknown=%FF", "https://example.test/a?barcode=%00", "https://example.test/a?barcode=%EF%BB%BFZ%EF%BB%BF", "https://example.test/a?barcode=1;epc=2", "https://example.test/a?barcode=1&&barcode=2", "https://example.test/a?barcode", "https://example.test/a?=x&qr=Q", "ftp://example.test/a", "foo://example.test/a", "file://localhost/a", "file://example.test/a", "http://b\u00fccher.example/a", "http://example.test/a%2Fb?x=%ZZ", "https://example.test/first%FF/last", "https://example.test/a?x=%E2%80%8B&qr=Q", "https://example.test/%2e", "https://example.test/%2E%2E", "https://example.test/a/..", "https://example.test/a?barcode=a%2Bb", "https://example.test/a?barcode=%252F", "https://example.test/a?barcode=%E2%82%AC", "https://example.test/a?%FF=x&barcode=A", "https://example.test/a?barcode=%26%3D", "https://example.test/a?barcode=A#X", "https://example.test/a?barcode=one&%62arcode=two", "https://example.test/a?barcode=first&barcode&epc=E", "https://example.test/\u00a0", "https://example.test/a?barcode=\u00a0", "https://example.test/a?barcode=%20%20", "https://example.test/a?barcode=A%00", " https://example.test/a?barcode= A "];
const authority = ["http://:99999/a/b", "file://:99999/a/b", "http://user@:99999/a/b", "http://@host:99999/a/b", "https://host:abc/a/b", "https://host:/a/b", "https://host:00000000000000000000000000000000000001/a", "foo://:12345/a/b", "file:///a/b", "foo:///a/b", "https://user@@host/a", "https://example.test:65536/a", "https://%65xample.test/a", "https://%FF/a", "https://example.test/a?=bad%FF&qr=Q", "https://example.test/a?x=%FF&qr=Q"];
const trimCodepoints = [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680, 0x180e, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x200b, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff];
function generateInputs() {
  let seed = 0xabcdef;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  const choose = values => values[random(values.length)];
  const schemes = ['http', 'https', 'foo', 'file'];
  const hosts = ['example.test', 'localhost', 'host.test:99999', 'bücher.example', '[::1]', 'user:pass@example.test'];
  const paths = ['', '/', '/a', '/a/b', '/%20', '/a%FF', '/a+b', '/%2F', '/a/%E2%80%8B', '/a/../B', '/x/%ZZ'];
  const keys = ['barcode', 'epc', 'qr', 'x', '%62arcode', 'bad%FF', ''];
  const vals = ['A', 'B', '', '%20', '%FF', '%ZZ', '%C0%AF', 'a+b', '%2F', 'abc%00def', '%F0%9F%93%A6'];
  const fuzz = [];
  for (let i = 0; i < 500; i++) {
    let value = `${choose(schemes)}://${choose(hosts)}${choose(paths)}`, count = random(5);
    if (count) { const query = []; for (let j = 0; j < count; j++) query.push(`${choose(keys)}=${choose(vals)}`); value += `?${query.join('&')}`; }
    if (random(5) === 0) value += '#fragment'; fuzz.push(value);
  }
  const trim = trimCodepoints.flatMap(code => { const c = String.fromCodePoint(code); return [`${c}CODE${c}`, `https://example.test/a?barcode=${c}CODE${c}`]; });
  return [...fixed, ...extra, ...fuzz, ...authority, ...trim];
}
module.exports = { generateInputs };
if (require.main === module) process.stdout.write(JSON.stringify(generateInputs()));
