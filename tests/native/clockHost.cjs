// Explicit native core check, kept outside the portable Node test glob.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'accord-clock-core-'));
const native = path.join(root, 'modules/accord-native-clock');
const expected = ['1700000000123456', '-1', '10000000000123457'];
function run(command, args) { return execFileSync(command, args, { encoding: 'utf8' }).trim(); }
function verify(output) {
  const lines = output.split('\n'); assert.deepEqual(lines.slice(0, 3), expected);
  const live = BigInt(lines[3]); assert.ok(live > 0n);
  assert.ok(live >= BigInt(Date.now() - 5000) * 1000n && live <= BigInt(Date.now() + 5000) * 1000n);
  assert.equal(lines[4], '1', 'the native clock must retain sub-millisecond precision');
}
try {
  const c = path.join(temporary, 'main.c'), binary = path.join(temporary, 'clock-c');
  fs.writeFileSync(c, `#include <inttypes.h>\n#include <stdio.h>\n#include "clock_core.h"\nint main(void) {\n` +
    `printf("%" PRId64 "\\n", accord_epoch_microseconds(1700000000, 123456));\n` +
    `printf("%" PRId64 "\\n", accord_epoch_microseconds(-1, 999999));\n` +
    `printf("%" PRId64 "\\n", accord_epoch_microseconds(10000000000LL, 123457));\n` +
    `int64_t now; if (accord_current_epoch_microseconds(&now) != 0) return 2; printf("%" PRId64 "\\n", now);\n` +
    `int precise = 0; for (int i=0; i<1000; i++) { if (accord_current_epoch_microseconds(&now) != 0) return 3; if (now % 1000) precise = 1; }\n` +
    `printf("%d\\n", precise); return 0; }\n`);
  const cpp = path.join(native, 'android/src/main/cpp');
  run('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-I', cpp, path.join(cpp, 'clock_core.c'), c, '-o', binary]);
  verify(run(binary, []));
  const swift = path.join(temporary, 'main.swift'), swiftBinary = path.join(temporary, 'clock-swift');
  fs.writeFileSync(swift, `import Foundation\n` +
    `print(EpochMicroseconds.from(seconds: 1700000000, microseconds: 123456))\n` +
    `print(EpochMicroseconds.from(seconds: -1, microseconds: 999999))\n` +
    `print(EpochMicroseconds.from(seconds: 10000000000, microseconds: 123457))\n` +
    `print(try EpochMicroseconds.now())\nvar precise = false\nfor _ in 0..<1000 { if Int64(try EpochMicroseconds.now())! % 1000 != 0 { precise = true } }\nprint(precise ? 1 : 0)\n`);
  run('xcrun', ['swiftc', path.join(native, 'ios/EpochMicroseconds.swift'), swift, '-o', swiftBinary]);
  verify(run(swiftBinary, []));
  process.stdout.write('C and Swift native clock cores passed: signed/exact 64-bit values, live UTC and microsecond precision.\n');
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
