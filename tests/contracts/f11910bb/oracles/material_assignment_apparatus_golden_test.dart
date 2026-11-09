import 'dart:convert';

import 'package:accord_mobile_v2/src/features/admin/logic/production_map_chain.dart';
import 'package:accord_mobile_v2/src/features/admin/models/production_map_models.dart';
import 'package:flutter_test/flutter_test.dart';

ProductionMapNode node(
  String id,
  String kind, [
  String machine = '',
  String group = '',
  String chosen = '',
]) => ProductionMapNode(
  id: id,
  kind: kind,
  title: id,
  apparatusId: machine,
  alternativeGroupId: group,
  alternativeAssignedApparatusId: chosen,
);
ProductionMapEdge edge(String from, String to, [String branch = '']) =>
    ProductionMapEdge(from: from, to: to, branch: branch);
const p = 'apparatus:default:asset-005',
    a = 'apparatus:default:asset-007',
    b = 'apparatus:default:asset-008',
    c = 'apparatus:default:asset-010';
void main() {
  test('dump isolated Material assignment apparatus oracle', () {
    final cases = <String, Map<String, Object>>{};
    void add(
      String name,
      List<ProductionMapNode> nodes,
      List<ProductionMapEdge> edges,
      List<String> assigned,
    ) {
      final map = ProductionMapDefinition(
        id: name,
        title: name,
        productCode: name,
        nodes: nodes,
        edges: edges,
      );
      cases[name] = {
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
      };
    }

    add(
      'canonical_topology',
      [
        node('start', 'start'),
        node('order', 'task'),
        node('print', 'apparatus', p),
        node('note', 'task'),
        node('cut', 'apparatus', c),
        node('end', 'end'),
      ],
      [
        edge('start', 'order'),
        edge('order', 'print'),
        edge('print', 'note'),
        edge('note', 'cut'),
        edge('cut', 'end'),
      ],
      [c, p, 'Flexo pechat', ' ' + p + ' '],
    );
    add(
      'representative_alternatives',
      [
        node('start', 'start'),
        node('print', 'apparatus', p),
        node('a', 'apparatus', a, 'lam', a),
        node('b', 'apparatus', b, 'lam', a),
        node('cut', 'apparatus', c),
        node('end', 'end'),
      ],
      [
        edge('start', 'print'),
        edge('print', 'a'),
        edge('a', 'cut'),
        edge('cut', 'end'),
      ],
      [c, b, a, p],
    );
    add(
      'assigned_identity_and_deduplicate',
      [
        node('start', 'start'),
        node('first', 'apparatus', p, '', a),
        node('again', 'apparatus', a),
        node('unreachable', 'apparatus', c),
      ],
      [edge('start', 'first'), edge('first', 'again')],
      [p, a, c],
    );
    add(
      'conditions_cycles_and_missing_targets',
      [
        node('start', 'start'),
        node('choice', 'condition'),
        node('yes', 'apparatus', p),
        node('no', 'apparatus', c),
        node('ignored', 'apparatus', a),
      ],
      [
        edge('start', 'choice'),
        edge('choice', 'yes', 'YES'),
        edge('choice', 'ignored', 'other'),
        edge('choice', 'no', "yo'q"),
        edge('yes', 'choice'),
        edge('no', 'missing'),
      ],
      [a, c, p],
    );
    add('no_start', [node('only', 'apparatus', p)], [], [p]);
    add(
      'alternative_without_outgoing_edge',
      [
        node('start', 'start'),
        node('a', 'apparatus', a, 'g'),
        node('b', 'apparatus', b, 'g'),
        node('cut', 'apparatus', c),
      ],
      [edge('start', 'b'), edge('a', 'cut')],
      [b, a, c],
    );
    add(
      'next_line_is_an_empty_group',
      [
        node('start', 'start'),
        node('a', 'apparatus', a, '\u0085'),
        node('b', 'apparatus', b, '\u0085'),
      ],
      [edge('start', 'a')],
      [a, b],
    );
    add(
      'next_line_trims_from_branch',
      [
        node('start', 'start'),
        node('choice', 'condition'),
        node('a', 'apparatus', a),
      ],
      [edge('start', 'choice'), edge('choice', 'a', 'yes\u0085')],
      [a],
    );
    add(
      'next_line_trims_from_assigned_id',
      [node('start', 'start'), node('a', 'apparatus', a)],
      [edge('start', 'a')],
      ['$a\u0085'],
    );
    add(
      'non_ascii_dart_canonical_id',
      [
        node('start', 'start'),
        node('a', 'apparatus', 'apparatus:default:\u037f'),
      ],
      [edge('start', 'a')],
      ['apparatus:default:\u037f'],
    );
    print('MATERIAL_CHAIN_ORACLE=${jsonEncode(cases)}');
  });
}
