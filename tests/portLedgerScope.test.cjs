// These fixtures exercise the diagnostic checkpoint, not a full scope repair.
// The ledger's declaration, route, shared-component and localization reachability
// still require a separate redesign before it can prove parity.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { before, after, test } = require('node:test');

const repo = path.join(__dirname, '..');
let fixture;
let report;
let run;

function write(root, relative, contents) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

before(() => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'accord-ledger-scope-'));
  const v4 = path.join(fixture, 'v4');
  const v2 = path.join(fixture, 'v2');
  const scripts = '.agents/skills/accord-port/scripts';
  for (const name of ['port_ledger.mjs', 'v2_graph.mjs', 'ui_text.mjs']) {
    write(v4, `${scripts}/${name}`, fs.readFileSync(path.join(repo, scripts, name)));
  }
  write(v4, '.agents/skills/accord-port/references/roles.json', JSON.stringify({
    partBudgetTokens: 10000,
    roles: [
      { id: 'customer', title: 'Customer', capabilities: ['customer.access'], features: ['customer'] },
      { id: 'preparation', title: 'Preparation', capabilities: ['preparation.access'], features: ['preparation'] },
    ],
  }));
  write(v2, 'pubspec.yaml', 'name: accord_mobile_v2\n');
  write(v2, 'lib/src/app/app_router_routeCapabilities.dart', `
const routes = {
  AppRoutes.customerHome: {'customer.access'},
  AppRoutes.preparation: {'preparation.access'},
};
`);
  write(v2, 'lib/src/app/app_router_methods_01.dart', `
Widget route(String name) {
  switch (name) {
    case AppRoutes.customerHome:
      return CustomerScreen();
    case AppRoutes.preparation:
      return PreparationScreen();
  }
}
`);
  write(v2, 'lib/src/features/customer/presentation/customer.dart', `
import '../../shared/presentation/shared.dart';
class CustomerScreen extends StatelessWidget {
  Widget build(BuildContext context) => Column(children: [
    Text(_statusLabel()),
    Text('Required customer-specific text'),
    SharedNotice(),
  ]);
}
String _statusLabel() => 'Customer status';
`);
  write(v2, 'lib/src/features/shared/presentation/shared.dart', `
class SharedNotice extends StatelessWidget {
  Widget build(BuildContext context) => Text('Shared notice');
}
`);
  write(v2, 'lib/src/features/preparation/presentation/preparation.dart', `
class PreparationScreen extends StatelessWidget {
  Widget build(BuildContext context) => Text('Text from a different role');
}
String _statusLabel() => 'Preparation status';
`);
  // Only this unrelated file carries the same-named tag. It must not make
  // its directory part of the customer scope or satisfy a customer text.
  write(v4, 'src/preparation/preparationInventory.ts', `
/** @v\x32 _statusLabel */
export const label = 'Required customer-specific text';
`);
  write(v4, 'src/preparation/Preparation.ios.tsx', `
export function Preparation() { return <Text>Unrelated preparation-only extra</Text>; }
`);
  for (const platform of ['ios', 'android']) {
    write(v4, `src/customer/Customer.${platform}.tsx`, `
import { SharedNotice } from '../shared/SharedNotice';
// @v\x32 CustomerScreen
export function Customer() {
  return <><Text>Text from a different role</Text><SharedNotice /></>;
}
`);
  }
  // The real shared component is imported by both platform views, but is
  // untagged. Its extra text must not be lost from the added-text check.
  write(v4, 'src/shared/SharedNotice.tsx', `
export function SharedNotice() {
  return <Text>Invented shared notice text</Text>;
}
`);
  run = spawnSync(process.execPath, [path.join(v4, scripts, 'port_ledger.mjs'),
    'text', 'customer', 'both', '--v2', v2], { encoding: 'utf8' });
  assert.notEqual(run.status, null, run.error?.message ?? run.stderr);
  const reportPath = path.join(v4, '.port/text-customer.md');
  assert.ok(fs.existsSync(reportPath), `No report produced:\n${run.stderr}`);
  report = fs.readFileSync(reportPath, 'utf8');
});

after(() => {
  if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
});

function platformPart(platform) {
  const start = report.indexOf(`## ${platform},`);
  assert.notEqual(start, -1, `Missing ${platform} section`);
  const end = report.indexOf('\n## ', start + 1);
  return report.slice(start, end < 0 ? undefined : end);
}

function diagnosticPart(platform, title, source = report) {
  const start = source.indexOf(`### ${platform}: ${title}`);
  assert.notEqual(start, -1, `Missing ${platform} ${title} diagnostic`);
  const end = source.indexOf('\n### ', start + 1);
  const otherEnd = source.indexOf('\n## ', start + 1);
  return source.slice(start, Math.min(end < 0 ? source.length : end, otherEnd < 0 ? source.length : otherEnd));
}

function rerun(which = 'both') {
  const v4 = path.join(fixture, 'v4');
  const v2 = path.join(fixture, 'v2');
  const result = spawnSync(process.execPath, [path.join(v4, '.agents/skills/accord-port/scripts/port_ledger.mjs'),
    'text', 'customer', which, '--v2', v2], { encoding: 'utf8' });
  assert.notEqual(result.status, null, result.error?.message ?? result.stderr);
  return { ...result, report: fs.readFileSync(path.join(v4, '.port/text-customer.md'), 'utf8') };
}

test('same-named private tags block and show the V4 tag and both V2 candidate libraries', () => {
  assert.equal(run.status, 1);
  assert.match(report, /Ambiguous selected @v\x32 tags \(1\)/);
  assert.match(report, /src\/preparation\/preparationInventory.ts:2 @v\x32 _statusLabel/);
  assert.match(report, /lib\/src\/features\/customer\/presentation\/customer.dart:10/);
  assert.match(report, /lib\/src\/features\/preparation\/presentation\/preparation.dart:5/);
});

test('customer text matched only in the uncertain native directory is reported for both platforms', () => {
  for (const platform of ['ios', 'android']) {
    assert.match(diagnosticPart(platform, 'V2 text matched only through ambiguous native scope'),
      /Required customer-specific text/);
  }
});

test('native text matched only by another V2 role is diagnosed on both platforms', () => {
  for (const platform of ['ios', 'android']) {
    assert.match(diagnosticPart(platform, 'V4 text matched globally but not in reached V2 declarations'),
      /Text from a different role <- src\/customer\/Customer/);
  }
});

test('the original missing and added checks still run and report their original candidates', () => {
  const ios = platformPart('ios');
  assert.match(ios, /Customer status/);
  assert.match(ios, /Shared notice/);
  assert.match(ios, /Unrelated preparation-only extra/);
  assert.match(run.stdout, /ios: 2 V2 texts not found in V4, 1 V4 texts not found in V2/);
});

test('diagnostics block even if every ordinary missing and added row is accepted', () => {
  write(path.join(fixture, 'v4'), 'docs/port/text/customer.tsv', [
    'both\tCustomer status\tfixture reason',
    'both\tShared notice\tfixture reason',
    'both\tUnrelated preparation-only extra\tfixture reason',
  ].join('\n'));
  const result = rerun();
  assert.match(result.stdout, /ios: 0 V2 texts not found in V4, 0 V4 texts not found in V2/);
  assert.match(result.stdout, /android: 0 V2 texts not found in V4, 0 V4 texts not found in V2/);
  assert.match(result.stdout, /1 ambiguous @v\x32 tag\(s\) block/);
  assert.equal(result.status, 1);
});

test('a global-only match alone blocks when ordinary comparisons and ambiguity are clear', () => {
  const v4 = path.join(fixture, 'v4');
  const v2 = path.join(fixture, 'v2');
  write(v2, 'lib/src/features/preparation/presentation/preparation.dart', `
class PreparationScreen extends StatelessWidget {
  Widget build(BuildContext context) => Text('Text from a different role');
}
String _preparationStatusLabel() => 'Preparation status';
`);
  write(v4, 'src/preparation/preparationInventory.ts', `
/** @v\x32 _preparationStatusLabel */
export const label = 'Required customer-specific text';
`);
  write(v4, 'docs/port/text/customer.tsv', [
    'both\tCustomer status\tfixture reason',
    'both\tShared notice\tfixture reason',
    'both\tRequired customer-specific text\tfixture reason',
  ].join('\n'));
  const result = rerun();
  assert.match(result.stdout, /ios: 0 V2 texts not found in V4, 0 V4 texts not found in V2/);
  assert.match(result.stdout, /0 ambiguous @v\x32 tag\(s\) block/);
  assert.match(diagnosticPart('ios', 'V4 text matched globally but not in reached V2 declarations', result.report),
    /Text from a different role/);
  assert.equal(result.status, 1);
  // Restore the collision for the following exception tests.
  write(v2, 'lib/src/features/preparation/presentation/preparation.dart', `
class PreparationScreen extends StatelessWidget {
  Widget build(BuildContext context) => Text('Text from a different role');
}
String _statusLabel() => 'Preparation status';
`);
  write(v4, 'src/preparation/preparationInventory.ts', `
/** @v\x32 _statusLabel */
export const label = 'Required customer-specific text';
`);
});

test('platform text exceptions apply to the matching diagnostic without suppressing the other platform', () => {
  write(path.join(fixture, 'v4'), 'docs/port/text/customer.tsv', [
    'both\tCustomer status\tfixture reason',
    'both\tShared notice\tfixture reason',
    'both\tUnrelated preparation-only extra\tfixture reason',
    'ios\tText from a different role\tfixture reason',
  ].join('\n'));
  const result = rerun();
  assert.doesNotMatch(diagnosticPart('ios', 'V4 text matched globally but not in reached V2 declarations', result.report),
    /Text from a different role/);
  assert.match(diagnosticPart('android', 'V4 text matched globally but not in reached V2 declarations', result.report),
    /Text from a different role/);
  assert.equal(result.status, 1);
});

test('a both-platform text exception does not waive an ambiguous tag identity', () => {
  write(path.join(fixture, 'v4'), 'docs/port/text/customer.tsv', [
    'both\tCustomer status\tfixture reason',
    'both\tShared notice\tfixture reason',
    'both\tUnrelated preparation-only extra\tfixture reason',
    'both\tText from a different role\tfixture reason',
    'both\tRequired customer-specific text\tfixture reason',
  ].join('\n'));
  const result = rerun();
  for (const platform of ['ios', 'android']) {
    assert.doesNotMatch(diagnosticPart(platform, 'V4 text matched globally but not in reached V2 declarations', result.report),
      /Text from a different role/);
  }
  assert.match(result.stdout, /1 ambiguous @v\x32 tag\(s\) block/);
  assert.equal(result.status, 1);
});

test('an opposite-platform ambiguous shared file does not block an unaffected platform', () => {
  const v4 = path.join(fixture, 'v4');
  write(v4, 'src/preparation/preparationInventory.ts', "export const label = 'Preparation status';\n");
  write(v4, 'src/shared/Foreign.android.tsx', "// @v\x32 _statusLabel\nexport const label = 'Preparation status';\n");
  write(v4, 'docs/port/text/customer.tsv', [
    'both\tCustomer status\tfixture reason',
    'both\tShared notice\tfixture reason',
    'both\tRequired customer-specific text\tfixture reason',
    'both\tText from a different role\tfixture reason',
  ].join('\n'));
  const ios = rerun('ios');
  assert.equal(ios.status, 0, ios.stdout + ios.stderr);
  assert.match(ios.report, /Ambiguous selected @v\x32 tags \(0\)/);
  const android = rerun('android');
  assert.equal(android.status, 1);
  assert.match(android.report, /src\/shared\/Foreign.android.tsx:1 @v\x32 _statusLabel/);
  fs.rmSync(path.join(v4, 'src/shared/Foreign.android.tsx'));
  write(v4, 'src/preparation/preparationInventory.ts', `
/** @v\x32 _statusLabel */
export const label = 'Required customer-specific text';
`);
});

test('an opposite-platform tag still blocks when it promotes a folder for this platform', () => {
  const v4 = path.join(fixture, 'v4');
  write(v4, 'src/preparation/preparationInventory.ts', "export const label = 'Preparation status';\n");
  write(v4, 'src/preparation/Foreign.ios.tsx', "// @v\x32 _statusLabel\nexport const label = 'Preparation status';\n");
  write(v4, 'src/preparation/Foreign.android.tsx', "export const label = 'Preparation status';\n");
  const android = rerun('android');
  assert.equal(android.status, 1);
  assert.match(android.report, /src\/preparation\/Foreign.ios.tsx:1 @v\x32 _statusLabel/);
  fs.rmSync(path.join(v4, 'src/preparation/Foreign.ios.tsx'));
  fs.rmSync(path.join(v4, 'src/preparation/Foreign.android.tsx'));
  write(v4, 'src/preparation/preparationInventory.ts', `
/** @v\x32 _statusLabel */
export const label = 'Required customer-specific text';
`);
});

test('single-platform reports and diagnostics remain platform-specific', () => {
  const result = rerun('ios');
  assert.match(result.report, /## ios,/);
  assert.doesNotMatch(result.report, /## android,/);
  assert.doesNotMatch(result.report, /### android:/);
});

test('a simple unambiguous scope with matching text has no new blockers', () => {
  const v4 = path.join(fixture, 'v4');
  const v2 = path.join(fixture, 'v2');
  write(v2, 'lib/src/features/preparation/presentation/preparation.dart', `
class PreparationScreen extends StatelessWidget {
  Widget build(BuildContext context) => Text('Text from a different role');
}
String _preparationStatusLabel() => 'Preparation status';
`);
  write(v4, 'src/preparation/preparationInventory.ts', `
/** @v\x32 _preparationStatusLabel */
export const label = 'Preparation status';
`);
  for (const platform of ['ios', 'android']) {
    write(v4, `src/customer/Customer.${platform}.tsx`, `
import { SharedNotice } from '../shared/SharedNotice';
// @v\x32 CustomerScreen
export function Customer() {
  return <><Text>Customer status</Text><Text>Required customer-specific text</Text><SharedNotice /></>;
}
`);
  }
  write(v4, 'src/shared/SharedNotice.tsx', `
export function SharedNotice() { return <Text>Shared notice</Text>; }
`);
  write(v4, 'docs/port/text/customer.tsv', '');
  const result = rerun();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.report, /Ambiguous selected @v\x32 tags \(0\)/);
  assert.match(result.stdout, /ios: 0 texts matched only through ambiguous native scope, 0 native texts matched only globally in V2/);
  assert.match(result.stdout, /android: 0 texts matched only through ambiguous native scope, 0 native texts matched only globally in V2/);
});

test('distinct declarations on the same Dart source line remain ambiguous', () => {
  const v4 = path.join(fixture, 'v4');
  const v2 = path.join(fixture, 'v2');
  write(v2, 'lib/src/features/customer/presentation/customer.dart', `
class CustomerScreen extends StatelessWidget {
  Widget build(BuildContext context) => Text(label());
}
String label() => 'Exact customer text'; extension Other on Object { int label() => 3; }
`);
  write(v4, 'src/customer/Customer.ios.tsx', `
/** @v\x32 label */
export const hasView = true;
`);
  write(v4, 'src/components/Unrelated.ios.tsx', `
export function Unrelated() { return <Text>Exact customer text</Text>; }
`);
  write(v4, 'docs/port/text/customer.tsv', '');
  const result = rerun('ios');
  assert.match(result.stdout, /ios: 0 V2 texts not found in V4, 0 V4 texts not found in V2/);
  assert.equal(result.status, 1, 'Ambiguous declarations must block even if ordinary counts are zero');
  assert.match(result.report, /Ambiguous selected @v\x32 tags \(1\)/);
  assert.match(result.report, /customer\.dart:5 \(member label; candidate 1\)/);
  assert.match(result.report, /customer\.dart:5 \(extension Other; candidate 2\)/);
});

test('an opposite-platform ambiguous tag does not taint a folder already selected by an in-platform tag', () => {
  const v4 = path.join(fixture, 'v4');
  const v2 = path.join(fixture, 'v2');
  write(v2, 'lib/src/features/customer/presentation/customer.dart', `
class CustomerScreen extends StatelessWidget {
  Widget build(BuildContext context) => Text(_label());
}
String _label() => 'Exact customer text';
`);
  write(v2, 'lib/src/features/preparation/presentation/preparation.dart', `
class PreparationScreen extends StatelessWidget {}
String _label() => 'Preparation label';
`);
  write(v4, 'src/customer/Customer.ios.tsx', 'export const ignored = true;\n');
  write(v4, 'src/customer/Customer.android.tsx', `
// @v\x32 CustomerScreen
export function Customer() { return <Text>Exact customer text</Text>; }
`);
  write(v4, 'src/customer/Other.ios.tsx', `
/** @v\x32 _label */
export const ignored = true;
`);
  const withOther = rerun('android');
  assert.match(withOther.stdout, /android: 0 V2 texts not found in V4, 0 V4 texts not found in V2/);
  assert.equal(withOther.status, 0, withOther.stdout);
  assert.match(withOther.report, /Ambiguous selected @v\x32 tags \(0\)/);
  assert.match(withOther.stdout, /android: 0 texts matched only through ambiguous native scope/);
  fs.rmSync(path.join(v4, 'src/customer/Other.ios.tsx'));
  const withoutOther = rerun('android');
  assert.equal(withoutOther.status, 0, withoutOther.stdout);
  assert.match(withoutOther.report, /Ambiguous selected @v\x32 tags \(0\)/);
});

test('opposite-platform ambiguous tags jointly promoting an otherwise unselected folder still block', () => {
  const v4 = path.join(fixture, 'v4');
  write(v4, 'src/customer/Customer.android.tsx', 'export const ignored = true;\n');
  for (const name of ['One', 'Two']) {
    write(v4, `src/foreign/${name}.ios.tsx`, `
/** @v\x32 _label */
export const ignored = true;
`);
  }
  write(v4, 'src/foreign/Actual.android.tsx', `
export function Actual() { return <Text>Exact customer text</Text>; }
`);
  const result = rerun('android');
  assert.match(result.stdout, /android: 0 V2 texts not found in V4, 0 V4 texts not found in V2/);
  assert.equal(result.status, 1);
  assert.match(result.report, /Ambiguous selected @v\x32 tags \(2\)/);
  assert.match(result.report, /src\/foreign\/One\.ios\.tsx:2 @v\x32 _label/);
  assert.match(result.report, /src\/foreign\/Two\.ios\.tsx:2 @v\x32 _label/);
});

test('distinct extension members on one graph node remain separate candidates', () => {
  const v4 = path.join(fixture, 'v4');
  const v2 = path.join(fixture, 'v2');
  fs.rmSync(path.join(v4, 'src/foreign'), { recursive: true, force: true });
  write(v2, 'lib/src/features/customer/presentation/customer.dart', `
class CustomerScreen extends StatelessWidget {
  Widget build(BuildContext context) => Text(label());
}
String label() => 'Exact customer text'; extension Other on Object { int get label => 3; set label(int value) {} }
`);
  write(v4, 'src/customer/Customer.ios.tsx', `
/** @v\x32 label */
export const hasView = true;
`);
  const result = rerun('ios');
  assert.match(result.stdout, /ios: 0 V2 texts not found in V4, 0 V4 texts not found in V2/);
  assert.equal(result.status, 1);
  assert.match(result.report, /customer\.dart:5 \(member label; candidate 1\)/);
  assert.match(result.report, /customer\.dart:5 \(extension Other; candidate 2\)/);
  assert.match(result.report, /customer\.dart:5 \(extension Other; candidate 3\)/);
});
