// Runs only in v2_oracle.sh's temporary baseline export; no real server is contacted.
import 'dart:convert';
import 'package:accord_mobile_v2/src/core/api/mobile_api.dart';
import 'package:accord_mobile_v2/src/core/session/session.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('Rezka source and split requests and models at selected V2 baseline', () async {
    AppSession.instance.token = 'rezka-oracle-token';
    addTearDown(() => AppSession.instance.token = null);
    final calls = <http.Request>[];
    final output = RezkaSplitOutputRequest(itemCode: ' I-1 ', itemName: ' Film ', qty: 2.5,
      uom: ' kg ', targetWarehouse: ' WH ', reason: ' why ');
    final request = RezkaSplitRequest(sourceBarcode: ' B 1 ', sourceStockEntry: ' SE ', sourceLineIndex: 3,
      reason: ' test ', driverUrl: ' http://printer/// ', printer: ' Zebra ', printMode: ' label ', outputs: [output]);
    final client = MockClient((call) async {
      calls.add(call);
      if (call.url.path.endsWith('/source')) {
        return http.Response(jsonEncode({'ok': true, 'source': {'barcode': ' B1 ', 'line_index': '3.8',
          'item_code': ' I-1 ', 'qty': '2.5', 'uom': ' kg '}}), 200);
      }
      return http.Response(jsonEncode({'ok': true, 'status': ' ready ', 'outputs': [
        {'epc': ' E1 ', 'qty': '2.5', 'print_qr': true}, {'epc': ' E2 ', 'print_qr': false}
      ]}), 200);
    });
    await http.runWithClient(() async {
      final source = await MobileApi.instance.rezkaSource(barcode: ' B 1 ');
      expect(source.source.barcode, 'B1'); expect(source.source.lineIndex, 3);
      expect(source.source.qty, 2.5); expect(source.source.uom, 'kg');
      final split = await MobileApi.instance.rezkaSplit(request);
      expect(split.status, 'ready'); expect(split.outputs[0].epc, 'E1');
      expect(split.outputs[1].printQr, false);
      await MobileApi.instance.rezkaSplitClientPrintPrepare(request);
      await MobileApi.instance.rezkaSplitClientPrintConfirm(request);
      expect(() => request.withPreparedOutputs(split.outputs), throwsStateError);
      expect(request.withPreparedOutputs([split.outputs[0]]).toJson()['outputs'], [
        {'epc': 'E1', 'item_code': 'I-1', 'item_name': 'Film', 'qty': 2.5,
         'uom': 'kg', 'target_warehouse': 'WH', 'reason': 'why', 'print_qr': true},
      ]);
    }, () => client);
    expect(calls.map((c) => c.url.path), [
      '/v1/mobile/rezka/source', '/v1/mobile/rezka/split',
      '/v1/mobile/rezka/split/client-print/prepare', '/v1/mobile/rezka/split/client-print/confirm']);
    expect(calls.first.url.queryParameters, {'barcode': 'B 1'});
    expect(calls.map((c) => c.method), ['GET', 'POST', 'POST', 'POST']);
    for (final call in calls.skip(1)) {
      expect(call.headers['content-type'], 'application/json');
      expect(jsonDecode(call.body), {'source_barcode': 'B 1', 'source_stock_entry': 'SE', 'source_line_index': 3,
        'reason': 'test', 'driver_url': 'http://printer', 'printer': 'Zebra', 'print_mode': 'label',
        'outputs': [{'item_code': 'I-1', 'item_name': 'Film', 'qty': 2.5, 'uom': 'kg',
          'target_warehouse': 'WH', 'reason': 'why', 'print_qr': true}]});
    }
  });
}
