import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:accord_mobile_v2/src/features/admin/logic/production_map_chain.dart';
import 'package:accord_mobile_v2/src/features/admin/models/production_map_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('seeded assignment topology ASCII comparisons', () {
    final rnd = Random(750109),
        ids = ['', 'a', ' b ', 'b', 'c', 's', 'dup', 'dup', '?'];
    final kinds = [
      'start',
      'apparatus',
      'apparatus',
      'task',
      'condition',
      'end',
    ];
    final machines = [
      '',
      'apparatus:x:a',
      'apparatus:x:b',
      'apparatus:x:c',
      ' apparatus:x:a ',
      'bad',
      'APPARATUS:X:A',
    ];
    final groups = ['', 'g', ' g ', 'h', ' '];
    final branches = ['', 'yes', 'no', ' YES ', 'yo\'q', 'false', '0', 'other'];
    String pick(List<String> xs) => xs[rnd.nextInt(xs.length)];
    final result = <Object>[];
    for (var iteration = 0; iteration < 3500; iteration++) {
      final nodes = <ProductionMapNode>[];
      final edges = <ProductionMapEdge>[];
      final nodeCount = 1 + rnd.nextInt(9), edgeCount = rnd.nextInt(15);
      for (var i = 0; i < nodeCount; i++) {
        nodes.add(
          ProductionMapNode(
            id: pick(ids),
            kind: pick(kinds),
            title: '',
            apparatusId: pick(machines),
            alternativeGroupId: pick(groups),
            alternativeAssignedApparatusId: pick(machines),
          ),
        );
      }
      for (var i = 0; i < edgeCount; i++) {
        edges.add(
          ProductionMapEdge(
            from: pick(ids),
            to: pick(ids),
            branch: pick(branches),
          ),
        );
      }
      final assigned = List.generate(rnd.nextInt(7), (_) => pick(machines));
      final map = ProductionMapDefinition(
        id: 'i',
        title: '',
        productCode: '',
        nodes: nodes,
        edges: edges,
      );
      result.add({
        'nodes': nodes
            .map(
              (n) => {
                'id': n.id,
                'kind': n.kind,
                'apparatus_id': n.apparatusId,
                'alternative_group_id': n.alternativeGroupId,
                'alternative_assigned_apparatus_id':
                    n.alternativeAssignedApparatusId,
              },
            )
            .toList(),
        'edges': edges
            .map((e) => {'from': e.from, 'to': e.to, 'branch': e.branch})
            .toList(),
        'assigned': assigned,
        'expected': productionMapAuthorizedOrderApparatus(
          map: map,
          assignedApparatus: assigned,
        ),
      });
    }
    File(Platform.environment['MATERIAL_TOPOLOGY_OUTPUT']!)
        .writeAsStringSync(jsonEncode(result));
    print('ASCII_TOPOLOGY_ORACLE_CASES=${result.length}');
  });
}
