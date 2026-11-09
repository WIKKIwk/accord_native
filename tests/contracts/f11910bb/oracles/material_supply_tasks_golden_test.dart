import 'dart:convert';

import 'package:accord_mobile_v2/src/core/api/mobile_api.dart';
import 'package:flutter_test/flutter_test.dart';

const station = 'apparatus:default:bosma_7';
Map<String, dynamic> row(String id, int position, {String state = 'missing'}) =>
    {
      'id': id,
      'code': id,
      'order_number': '42',
      'title': 'Mahsulot 😀',
      'product_code': 'product',
      'customer_name': 'Mijoz',
      'image_id': 'image-1',
      'position': position,
      'apparatus_count': 2,
      'task_state': state,
    };
Map<String, dynamic> wire({String kind = 'material', String search = ''}) => {
  'ok': true,
  'projection': 'supply_tasks_v1',
  'kind': kind,
  'epoch': 'server',
  'scope': 'scope',
  'rev': 7,
  'version': 'version-7',
  'apparatus_id': station,
  'limit': 10,
  'search': search,
  'checked_count': 10,
  'missing_count': 2,
  'rows': [row('first', 0), row('third', 2, state: 'partial')],
  'apparatus': [
    {
      'apparatus_id': station,
      'source_revision': 1,
      'source_aasx_sha256': '1' * 64,
      'display': {'display_name': 'Bosma 7'},
      'execution_profile': {'operation': 'print', 'technology': 'flexographic'},
    },
  ],
};
Map<String, dynamic> delta() => {
  'ok': true,
  'type': 'tasks_delta',
  'epoch': 'server',
  'scope': 'scope',
  'base_rev': 7,
  'rev': 8,
  'version': 'version-8',
  'checked_count': 10,
  'missing_count': 2,
  'order_ids': ['second', 'third'],
  'upsert': [row('second', 1), row('third', 2)],
  'remove': ['first'],
};
Map<String, dynamic> ready() => {
  'ok': true,
  'type': 'tasks_ready',
  'epoch': 'server',
  'scope': 'scope',
  'rev': 7,
  'version': 'version-7',
  'resync': false,
};
Map<String, Object?> summary(SupplyTaskWindow w) => {
  'kind': w.kind,
  'scope': w.scope,
  'epoch': w.epoch,
  'revision': w.revision,
  'version': w.version,
  'apparatus_id': w.apparatusId,
  'limit': w.limit,
  'search': w.search,
  'checked_count': w.checkedCount,
  'missing_count': w.missingCount,
  'rows': w.rows.map((r) => r.toJson()).toList(),
  'apparatus_ids': w.apparatus.map((a) => a.id).toList(),
};
void main() {
  test('emit source-derived supply task model cases', () {
    final windows = <String, Object?>{}, messages = <String, Object?>{};
    void window(String name, Map<String, dynamic> raw) {
      try {
        windows[name] = {
          'input': raw,
          'expected': {
            'ok': true,
            'value': summary(SupplyTaskWindow.fromJson(raw)),
          },
        };
      } catch (e) {
        windows[name] = {
          'input': raw,
          'expected': {
            'ok': false,
            'code': e is MobileApiException ? e.code : e.runtimeType.toString(),
          },
        };
      }
    }

    void message(String name, Map<String, dynamic> raw) {
      try {
        final baseline = SupplyTaskWindow.fromJson(wire()),
            next = SupplyTaskMessage.fromJson(raw).applyTo(baseline);
        messages[name] = {
          'input': raw,
          'expected': {
            'ok': true,
            'value': summary(next),
            'same_object': identical(baseline, next),
            'baseline_rows': baseline.rows.map((r) => r.id).toList(),
          },
        };
      } catch (e) {
        messages[name] = {
          'input': raw,
          'expected': {
            'ok': false,
            'code': e is MobileApiException ? e.code : e.runtimeType.toString(),
          },
        };
      }
    }

    window('material', wire());
    window('qolip', wire(kind: 'qolip'));
    final enriched = wire();
    final first = (enriched['rows'] as List).first as Map<String, dynamic>;
    first['combo'] = {
      'id': 'layout',
      'item_code': 'SKU',
      'name': 'Combo',
      'revision': 2,
      'layout_fingerprint': 'fp',
    };
    first['products'] = [
      {
        'id': 'child',
        'item_code': 'SKU-1',
        'product': 'Child',
        'frame_product_size_mm': 12.5,
        'frame_count': 2,
      },
      'ignored',
    ];
    window('combo_products', enriched);
    window(
      'search_subset',
      wire(search: 'hello')..['rows'] = [row('third', 2, state: 'partial')],
    );
    window(
      'empty',
      wire()..addAll({
        'apparatus': [],
        'apparatus_id': '',
        'checked_count': 0,
        'missing_count': 0,
        'rows': [],
      }),
    );
    window('missing_rows', wire()..remove('rows'));
    window('missing_apparatus', wire()..remove('apparatus'));
    window('string_count', wire()..['checked_count'] = '10');
    window('too_many_missing', wire()..['missing_count'] = 11);
    window('wrong_projection', wire()..['projection'] = 'worker_list_v1');
    window('empty_scope', wire()..['scope'] = '');
    window('scope_only_next_line', wire()..['scope'] = '\u0085');
    final blankId = wire();
    ((blankId['rows'] as List).first as Map<String, dynamic>)['id'] = '\u0085';
    window('id_only_next_line', blankId);
    window('unsearched_incomplete', wire()..['rows'] = []);
    window(
      'duplicate_ids',
      wire()..['rows'] = [row('same', 0), row('same', 1)],
    );
    window('out_of_window', wire()..['rows'] = [row('bad', 10)]);
    window('invalid_state', wire()..['rows'] = [row('bad', 0, state: 'ready')]);
    window(
      'out_of_order',
      wire()..['rows'] = [row('later', 2), row('earlier', 0)],
    );
    window(
      'wrong_selected',
      wire()..['apparatus_id'] = 'apparatus:default:other',
    );
    window(
      'duplicate_apparatus',
      wire()..['apparatus'] = [wire()['apparatus'][0], wire()['apparatus'][0]],
    );
    window(
      'no_apparatus_but_rows',
      wire()..addAll({'apparatus': [], 'apparatus_id': ''}),
    );
    window('unsafe_revision', wire()..['rev'] = 9007199254740992);
    window('floating_revision', wire()..['rev'] = 7.0);
    final unicodeId = wire();
    unicodeId['apparatus_id'] = 'apparatus:default:\u037f';
    ((unicodeId['apparatus'] as List).first
            as Map<String, dynamic>)['apparatus_id'] =
        'apparatus:default:\u037f';
    window('dart_unicode_apparatus', unicodeId);
    message('delta', delta());
    message(
      'checkpoint',
      delta()..addAll({
        'order_ids': ['first', 'third'],
        'upsert': [],
        'remove': [],
      }),
    );
    message('ready', ready());
    message('wrong_ready_revision', ready()..['rev'] = 8);
    message('ready_resync', ready()..['resync'] = true);
    message('wrong_base', delta()..['base_rev'] = 6);
    message('wrong_epoch', delta()..['epoch'] = 'old');
    message('wrong_scope', delta()..['scope'] = 'other');
    message('missing_remove', delta()..['remove'] = []);
    message('missing_upsert', delta()..['upsert'] = []);
    message(
      'duplicate_order_ids',
      delta()..['order_ids'] = ['second', 'second'],
    );
    message(
      'invalid_upsert_position',
      delta()..['upsert'] = [row('second', 12)],
    );
    message('snapshot', {
      'ok': true,
      'type': 'tasks_snapshot',
      'window': wire()..['rev'] = 9,
    });
    message('wrong_kind_snapshot', {
      'ok': true,
      'type': 'tasks_snapshot',
      'window': wire(kind: 'qolip'),
    });
    message('unknown_type', {'ok': true, 'type': 'unknown'});
    message('snapshot_without_window', {'ok': true, 'type': 'tasks_snapshot'});
    print(
      'MATERIAL_SUPPLY_ORACLE=${jsonEncode({'windows': windows, 'messages': messages})}',
    );
  });
}
