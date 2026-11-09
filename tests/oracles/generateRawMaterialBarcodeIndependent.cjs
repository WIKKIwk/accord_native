// Independent deterministic URI combinations, reviewed against pinned Dart source.
function independent() {
let state=0x9637ca12;function random(){state^=state<<13;state^=state>>>17;state^=state<<5;return state>>>0}function pick(a){return a[random()%a.length]}function maybe(v){return random()%3?v:''}
const schemes=['https','HTTP','ftp','wss','x','git+ssh','S','a.1','1x','data','mailto','x-y','x_z',''];
const slashes=['://',':\\\\',':/\\',':\\/', ':///',':://',':/'];
const users=['','user@','us%65r@','u:p@','x@@','@','[u]@'];
const hosts=['example.com','EXample.com','a','a_b','%41.com','%FF','[::1]','[vA.xyz]','[::ffff:192.0.2.1]','[fe80::1%25en0]','[2001:db8:::1]','', '🙂','foo%','foo%2Fbar','foo bar','[::1','host]','.;'];
const ports=['',':',':0',':00080',':443',':+4',':-1',':0x10',':99999999999999999999',':foo',': 2',':80:3'];
const segs=['','a','30','40','a%2Fb','%2e','%2e%2e','.','..','%252E','%FF','%E2%82%AC','%C0%AF','%00','x+y','hello world','🤖','_',':','[',']','%'];
const keys=['barcode','epc','qr','bar%63ode','%65pc','QR','x','','a+b','%FF'];
const vals=['A','  ','A%20B','%FF','%C3%A9','%C0%AF','x+y','%2F','.', '%','', '🤖','%00'];
const ends=['','#','##x','#f?query','#%FF','#a/b'];const trim=['',' ','\u0085','\uFEFF','\t','\u200b'];
let rows=[]; for(let i=0;i<30000;i++){let s=pick(trim)+pick(schemes)+pick(slashes)+pick(users)+pick(hosts)+pick(ports);let n=random()%5;for(let j=0;j<n;j++)s+='/'+pick(segs);if(random()%4){s+='?';let n=1+random()%5;for(let j=0;j<n;j++){if(j)s+='&';s+=pick(keys)+(random()%5?'='+pick(vals):'')}}s+=pick(ends)+pick(trim);rows.push(s)}return rows;
}
module.exports = { independent };
if (require.main === module) process.stdout.write(JSON.stringify(independent()));
