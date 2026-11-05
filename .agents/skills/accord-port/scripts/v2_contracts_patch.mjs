// Helper for v2_contracts.sh. Patches the temporary copy of package:http and collects what it recorded.
import fs from 'node:fs';
import path from 'node:path';

const RECORDING_SEND = `
  @override
  Future<StreamedResponse> send(BaseRequest request) async {
    final sent = await request.finalize().toBytes();
    final StreamedResponse response;
    try {
      response = await _handler(request, ByteStream.fromBytes(sent));
    } catch (error) {
      _accordRecord(request, sent, error: error.runtimeType.toString());
      rethrow;
    }
    final received = await response.stream.toBytes();
    _accordRecord(request, sent, response: response, received: received);
    return StreamedResponse(ByteStream.fromBytes(received), response.statusCode,
        contentLength: response.contentLength,
        request: response.request,
        headers: response.headers,
        isRedirect: response.isRedirect,
        persistentConnection: response.persistentConnection,
        reasonPhrase: response.reasonPhrase);
  }
`;
const RECORDER = `
Object? _accordBody(List<int> bytes) {
  try {
    return {'text': utf8.decode(bytes)};
  } catch (_) {
    return {'base64': base64Encode(bytes)};
  }
}

void _accordRecord(BaseRequest request, List<int> sent,
    {StreamedResponse? response, List<int>? received, String? error}) {
  final out = Platform.environment['ACCORD_CONTRACT_OUT'];
  if (out == null) return;
  var testName = '';
  var suite = 'unknown';
  try {
    final dynamic invoker = Zone.current[#test.invoker];
    testName = invoker.liveTest.test.name as String;
    suite = (invoker.liveTest.suite.path as String?) ?? 'unknown';
  } catch (_) {}
  final stem = suite.split('/').last.replaceAll('.dart', '');
  File('$out/$stem.jsonl').writeAsStringSync(
      '\${jsonEncode({
        'test': testName,
        'method': request.method,
        'url': request.url.toString(),
        'requestHeaders': request.headers,
        'requestBody': _accordBody(sent),
        if (response != null) 'status': response.statusCode,
        if (response != null) 'responseHeaders': response.headers,
        if (received != null) 'responseBody': _accordBody(received),
        if (error != null) 'error': error,
      })}\\n',
      mode: FileMode.append,
      flush: true);
}
`;

function patch(mockClientFile, pubspecFile) {
  let source = fs.readFileSync(mockClientFile, 'utf8');
  const original = /\n\s*@override\s*\n\s*Future<StreamedResponse> send\(BaseRequest request\) async \{[\s\S]*?\n {2}\}\n/;
  if (!original.test(source)) throw new Error('MockClient.send was not found. Has package:http changed?');
  source = source.replace(original, RECORDING_SEND);
  source = source.replace("import 'dart:convert';", "import 'dart:async';\nimport 'dart:convert';\nimport 'dart:io';");
  fs.writeFileSync(mockClientFile, source + RECORDER);
  let pubspec = fs.readFileSync(pubspecFile, 'utf8');
  if (!/^dependency_overrides:/m.test(pubspec)) throw new Error('pubspec.yaml has no dependency_overrides section.');
  pubspec = pubspec.replace(/^dependency_overrides:\n/m, 'dependency_overrides:\n  http:\n    path: third_party/http_recording\n');
  fs.writeFileSync(pubspecFile, pubspec);
}

function collect(fromDir, toDir, baseline) {
  fs.mkdirSync(toDir, { recursive: true });
  const files = fs.readdirSync(fromDir).filter(name => name.endsWith('.jsonl'));
  let total = 0;
  for (const name of files) {
    const records = fs.readFileSync(path.join(fromDir, name), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    const stem = name.replace('.jsonl', '');
    fs.writeFileSync(path.join(toDir, `${stem}.json`), `${JSON.stringify({ source: `test/${stem}.dart`, baseline, records }, null, 1)}\n`);
    total += records.length;
    console.log(`${stem}: ${records.length} requests in ${new Set(records.map(item => item.test)).size} tests`);
  }
  console.log(`Recorded ${total} requests from ${files.length} test files into tests/contracts/.`);
}

if (process.argv[2] === '--collect') collect(process.argv[3], process.argv[4], process.argv[5]);
else patch(process.argv[2], process.argv[3]);
