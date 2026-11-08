// Deterministic, offline input corpora for the pinned f119 Dart barcode oracle.
function expanded() {
const fixed = [
  'https:30/40', 'https://%FF/a', 'https://%FE/a', 'https://%C0%AF/a', 'https://%ZZ/a', 'https://%/a',
  'http:////host/path', 'https://@/a', 'https://user@@host/a', 'https://%FF/a?barcode=B&barcode=C',
  'http://[::1]:65536/a', 'https://[v1.a]/p', 'https://[fe80::1%25en0]/p', 'https://host:/p',
  'https://host:foo/p', 'https://host:9999999999999999999999999/p', 'file://localhost/p',
  'https://host/a/%2E%2E/b', 'https://host/a/..%2f/b', 'https://host/%00', 'https://host/?barcode=%FF',
  'https://host/path?barcode=1&barcode=2', 'https://host/path?=bad%FF&qr=Q', 'https://host/path?x=%FF&barcode=A',
  'https://host\\evil/path', 'https://host\\evil?barcode=A', 'foo://host\\evil/a', 'https://host/a\\b',
  'https://host/⁄a', 'https://host/？x', 'https://host/＃x', 'https://host/?barcode=\u0085A\u0085',
];
const schemes=['http','https','foo','file','ftp','wss','git+ssh','x','MAILTO','HTTP','1http','https:',''];
const authorities=['host','%FF','%FE','%C0%AF','%ZZ','%','%00','%2F','%40','localhost','user@host','user@@host','@host','user:p@host','a:b@host','host:99999','host:-1','host:abc','host:','[::1]','[::1]:','[::1]:x','[fe80::1%25en0]','[v1.a]','[::zzz]','[bad','host:65536',' host','host\\evil','bücher.example','a..b','host%2f.other','%40','host:000080','[::ffff:192.0.2.128]','a:b:c','', 'a%EF%BB%BF','https:evil'];
const paths=['','/','/a','/%FF','/%ZZ','/%2e','/./x','/%2E%2E/x','/a/../b','/a/..','//host/xxx','/a+b','/a%2Fb','/a/%E2%80%8B','/a b','/%','/%2','/a\\b','/é','/a///b/','/📦','/a/%EF%BB%BF','/a/%C0%AF','?','/#x'];
const queries=['','?barcode=A&barcode=B','?=bad%FF&qr=Q','?x=%FF&barcode=A','?barcode=%FF','?barcode=%ZZ','?barcode=A&barcode=&epc=E','?%62arcode=B','?epc=a+b','?qr=%20','?barcode=%E2%80%8B','?barcode=%00','?barcode=%EF%BB%BFZ%EF%BB%BF','?barcode=one&barcode=two&barcode=three','?x=%','?%FF=A','?barcode=A#frag','?&=bad&qr=Q','?barcode=+'];
let seed=0x7b8e9c1d;function next(n){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)%n;}const choose=a=>a[next(a.length)];
const cases=new Set(fixed);for(const authority of authorities)for(const suffix of ['/path','/path?barcode=A&barcode=B','/%FF?qr=Q',''])cases.add(`https://${authority}${suffix}`);
while(cases.size<12000){const form=next(6);let value;if(form===0)value=`${choose(schemes)}:${choose(paths)}${choose(queries)}`;else if(form===1)value=`${choose(schemes)}:////${choose(authorities)}${choose(paths)}${choose(queries)}`;else value=`${choose(schemes)}://${choose(authorities)}${choose(paths)}${choose(queries)}`;cases.add(value);}
return [...cases];

}

function deep() {
const cases=new Set();
const hosts=['[::]','[::1]','[::ffff:192.0.2.1]','[::ffff:192.168.001.1]','[1:2:3:4:5:6:7:8]','[1:2:3:4:5:6:7]','[1:2:3:4:5:6:7:8:9]','[::1::2]','[2001:db8::1]','[2001:DB8::1]','[fe80::1%25en0]','[fe80::1%en0]','[fe80::1%]','[fe80::1%25]','[fe80::1%25en%41]','[fe80::1%25en%ZZ]','[fe80::1%25en:0]','[v1.a]','[vF.foo]','[V1.foo]','[v1.%FF]','[v1.foo:bar]','[v1.]','[v.a]','[vG.a]','[v1.a@b]','[bad]','[]','[::1','[::1]x','[%FF]','host','%FF','%ZZ','%00','%2F','localhost','host.name','bücher.example','bad host','x[y]','[x]y','x]','1.2.3.999','user@host','@host','user@@host','user:p@host','user%40name@host','',':','@'];
const ports=['',':',':0',':80',':443',':65535',':65536',':9999999999999999999999999',':-1',':+1',':-',':+',':0x10',':00',':1.1',':abc',':١',': 2',':+0002',':-0002'];
const tails=['/a','/a?barcode=A&barcode=B','/a/%FF?qr=Q','/../B',''];
for(const host of hosts)for(const port of ports)for(const tail of tails)cases.add(`https://${host}${port}${tail}`);
const paths=['','/','//','///','/a','/./','/../','/a/../b','/a/..','/a/.','/%2e','/%2e%2e','/%2e./b','/.%2e/b','/%252e/b','/%2F','/%5c','/a\\b','/a\tb','/a\rb','/a\nb','/a b','/%','/%2','/%ZZ','/%FF','/%E0%A4%A','/%C0%AF','/é','/📦','/\uFEFF','/\u0085','/a//../b','/a/%FF/../b'];
const auths=['host','%FF','bad host','user@host','[::1]','[fe80::1%25en0]','[v1.a]','host:65536','host:-1','host:+1','host:0x10',''];
const qs=['','?barcode=A&barcode=B','?barcode=%FF','?=x%FF&qr=Q','?x=%FF&barcode=A','?barcode=%ZZ','?barcode=a+b','?barcode=+','?barcode=%EF%BB%BF','?barcode=\u0085A\u0085','?barcode=A#B','?epc=&epc=E&qr=Q','?%62arcode=A&barcode=B','?%00=ignored&qr=Q'];
for(const a of auths)for(const p of paths)for(const q of qs)cases.add(`foo://${a}${p}${q}`);
const schemeCases=['https:30/40','https:\\\\host/a','https:\\/host/a','https:/\\host/a','https:////host/a','https://host\\abc/a','foo:\\\\host/a','file:host/a','file:/host/a','file:\\\\host/a','://host/a','a+b://host/a','a.b://host/a','1a://host/a','☃://host/a','https://user@@host/a','https://host?barcode=A','https://host#foo?barcode=A'];for(const s of schemeCases)cases.add(s);
let seed=0x49e32a17;function next(n){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)%n;}const choose=a=>a[next(a.length)],schemes=['http','https','foo','file','git+ssh','x','HTTP','1bad'];while(cases.size<50000){let prefix=`${choose(schemes)}://${choose(hosts)}${choose(ports)}`,path=choose(paths),query=choose(qs);if(next(4)===0)prefix=prefix.replace('//','\\\\');cases.add(prefix+path+query);}
return [...cases];

}

function ipv6() {
const fs=require('fs'),out=new Set(),fixed=['::','::1','2001:db8::1','1:2:3:4:5:6:7:8','1:2:3:4:5:6:7','1:2:3:4:5:6:7:8:9','::ffff:192.0.2.1','::ffff:192.168.001.1','::ffff:256.0.0.1','::ffff:1.2.3.4:5',':::1','1:::','1::2::3','v1.a','vF.foo','V1.foo','v1.','v.a','v1.a@b','fe80::1%25en0','fe80::1%25','fe80::1%25en%ZZ','fe80::1%25en#','fe80::1%25en/','fe80::1%25en]'];
for(const a of fixed)for(const t of ['/a','/a?barcode=A&barcode=B'])out.add(`https://[${a}]${t}`);
const group=['0','1','00','0000','F','fFfF','1234','12345','g','192.168.0.1','192.168.001.1','256.0.0.1','1.2.3','1.2.3.4','', 'v1.a','@','%25z','%ZZ'];let seed=0xe34a920d;function next(n){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)%n;}const pick=a=>a[next(a.length)];while(out.size<20000){const n=next(10),parts=[];for(let i=0;i<n;i++)parts.push(pick(group));let a=parts.join(':');if(next(2))a=a.slice(0,next(a.length+1))+'::'+a.slice(next(a.length+1));if(next(5)===0)a+='%'+pick(['25z','25','en0','ZZ','25en%41','25en%ZZ']);const suffix=pick(['/a','/a?barcode=A&barcode=B','/%FF?qr=Q','']);out.add(`https://[${a}]${suffix}`);}return [...out];

}

function ascii() {
const out=new Set();for(let i=0;i<128;i++){const c=String.fromCharCode(i);for(const value of [
  `https://ho${c}st/a`,`https://host/a${c}b`,`https://host/?bar${c}code=A`,`https://host/?barcode=A${c}B`,`https://host/a/.?x=${c}`,
  `https://host:9999999999999999999999999/a?x=${c}`,`https://ho${c}st:9999999999999999999999999/a`,`https://host:12${c}3/a`,
  `https://user${c}@host/a`,`https://${c}host/a`,`https://host/a#x${c}`,`https://host/a/.#x${c}`,`https://host/a/${c}/../b`,
  `https://host/a?${c}=value&barcode=Q`,`https://[fe80::1%25en${c}]/a`])out.add(value);}return [...out];
}

function unicode() {
const out=new Set(),points=[0,0x7f,0x85,0xa0,0x1680,0x180e,0x200b,0x2028,0x2029,0x202f,0x205f,0x3000,0xfeff,0xfffd,0xd7ff,0xd800,0xdbff,0xdc00,0xdfff,0xe000,0xffff,0x10000,0x1f4e6,0x10ffff];
let seed=0x516ac9b7;function next(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;}for(let i=0;i<750;i++)points.push(next()%0x110000);
for(const n of points){const c=n>=0xd800&&n<=0xdfff?String.fromCharCode(n):String.fromCodePoint(n);for(const value of [
  `${c}opaque${c}`,`https://${c}host/a`,`https://host/a/${c}`,`https://host/?barcode=${c}X${c}`,
  `https://host/a/.?x=${c}`,`https://host:9999999999999999999999999/a?x=${c}`])out.add(value);}return [...out];
}

function schemes() {
return ["data://host/a", "DATA://host/a", "data://host/a?barcode=A", "data://host/a,hello", "data:text/plain,hi", "data://host/a?barcode=A,hi", "http://host/a", "file://host/a", "file:////host/a", "https:30/40", "http:\\\\host\\a", "mailto://host/a", "urn://host/a", "ws://host/a", "ftp://host/a", "a+1.-://host/a"];
}

function dotPort() {
const out=[];for(const scheme of ['http','https','foo','x','ftp','file'])for(const port of ['','0','00','01','1','80','080','443','0443','65536','-1','+1','0x10','9999999999999999999999999'])out.push(`${scheme}://host${port?':'+port:''}/a/.?barcode=+`);return out;
}

const generators={expanded,deep,ipv6,ascii,unicode,schemes,dotPort};
module.exports={generators};
if(require.main===module){const name=process.argv[2];if(!Object.hasOwn(generators,name))throw new Error('Unknown corpus');process.stdout.write(JSON.stringify(generators[name]()));}
