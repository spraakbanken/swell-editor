import {QC, test, qc, Gen} from './Common'
import {graph, graph_with_tokens} from './Common'

import * as T from '../src/Token'
import * as G from '../src/Graph'
import {Graph} from '../src/Graph'
import * as Utils from '../src/Utils'
import {range} from '../src/Utils'
import * as C from '../src/Compact'

qc('roundtrip units<->graph', graph, (g0, p) => {
  const g = G.normalize_whitespace(g0)
  const g2 = C.stu_to_graph(C.graph_to_units(g))
  return p.deepEquals(g, G.normalize_whitespace(g2))
})

const graph_with_symbols = graph_with_tokens(Gen.nestring(Gen.char(`a:@^~'"\\`)).map(s => s + ' '))
const gen_units = graph_with_symbols.map(
  g => C.graph_to_units(G.normalize_whitespace(g, '')).source
)

qc('roundtrip string<->units', gen_units, (units, p) =>
  p.deepEquals(units, C.parse_strict(C.units_to_string(units)))
)

const gen_init_units = Gen.nestring(Gen.char(' ab')).map(s => C.graph_to_units(G.init('a' + s)))

qc('init is minimal', gen_init_units, stu => {
  const m = C.minimize(stu)
  const blank = (u: C.Unit) => u.links.length == 0 && u.ids.length == 0
  return m.source.every(blank) && m.target.every(blank)
})

const gen_rearranged_init_units = gen_init_units.then(stu =>
  Gen.range(stu.target.length)
    .replicate(2)
    .map(([begin, dest]) => ({
      stu: {...stu, target: Utils.rearrange(stu.target, begin, begin, dest)},
      begin,
      dest,
    }))
)

qc('init rearrange minimal bound', gen_rearranged_init_units, (r, p) => {
  const m = p.tap(C.minimize(r.stu))
  const not_blank = (u: C.Unit) => u.links.length != 0 || u.ids.length != 0
  const i = m.source.filter(not_blank).length
  const j = m.target.filter(not_blank).length
  const dist = Math.abs(r.begin - r.dest)
  return i + j <= 2 * dist
})
