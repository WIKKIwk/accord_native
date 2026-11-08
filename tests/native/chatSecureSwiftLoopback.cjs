/* Run on a Mac with Command Line Tools: node tests/native/chatSecureSwiftLoopback.cjs */
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}
async function run() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'accord-chat-host-'));
  const source = http.createServer();
  const destination = http.createServer();
  const observed = [];
  let redirected = 0;
  try {
    const targetPort = await listen(destination);
    destination.on('upgrade', (_request, socket) => { redirected++; socket.destroy(); });
    destination.on('request', (_request, response) => { redirected++; response.end(); });
    source.on('upgrade', (request, socket) => {
      observed.push({ url: request.url, headers: request.headers });
      if (request.url.startsWith('/redirect?')) {
        socket.end(`HTTP/1.1 302 Found\r\nLocation: ws://127.0.0.1:${targetPort}/elsewhere\r\nSet-Cookie: synthetic=secret; Path=/\r\nContent-Length: 0\r\n\r\n`);
      } else socket.end('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n');
    });
    const port = await listen(source);
    const exe = path.join(temporary, 'swift-host-test');
    const build = spawnSync('swiftc', [
      'modules/accord-chat-secure/ios/ChatSecureSockets.swift', 'tests/native/ChatSecureSocketsHost.swift', '-o', exe,
    ], { encoding: 'utf8' });
    assert.equal(build.status, 0, build.stderr);
    const child = spawn(exe, [String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 12000);
    const code = await new Promise(resolve => child.once('close', resolve));
    clearTimeout(timer);
    assert.equal(code, 0, output);
    assert.equal(observed.length, 2, JSON.stringify(observed));
    assert.equal(redirected, 0, 'redirect must not reach the second origin');
    for (const request of observed) {
      assert.equal(request.headers.cookie, undefined);
      assert.equal(request.headers.authorization, undefined);
      assert.match(request.url, /ticket=synthetic-ticket$/);
    }
    process.stdout.write(output);
  } finally {
    source.close(); destination.close();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
