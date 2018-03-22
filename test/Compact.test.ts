import {qc} from './Common'
import {Gen} from 'proptest'
import * as QC from 'proptest'

import {graph, graph_with_tokens} from './Common'

import * as T from '../src/Token'
import * as G from '../src/Graph'
import {Graph} from '../src/Graph'
import * as Utils from '../src/Utils'
import {range} from '../src/Utils'
import * as C from '../src/Compact'

import * as assert from 'assert'

qc('roundtrip units<->graph', graph, (g, p) => {
  const stu = C.graph_to_units(g)
  const g2 = C.units_to_graph(stu.source, stu.target)
  return p.equals(g, g2)
})

const graph_with_symbols = graph_with_tokens(QC.nestring(QC.char(`a:@^~'"\\`)).map(s => s + ' '))
export const gen_stu = graph_with_symbols.map(C.graph_to_units)

export const gen_units = gen_stu.map(stu => stu.source)

qc('roundtrip string<->units', gen_units, (units, p) =>
  p.equals(units, C.parse_strict(p.tap(C.units_to_string(units))))
)

const gen_init_units = QC.nestring(QC.char(' ab')).map(s => C.graph_to_units(G.init('a' + s)))

qc('init is minimal', gen_init_units, stu => {
  const m = C.minimize(stu)
  const blank = (u: C.Unit) => u.links.length == 0 && u.ids.length == 0
  return m.source.every(blank) && m.target.every(blank)
})

const gen_rearranged_init_units = gen_init_units.chain(stu =>
  QC.range(stu.target.length)
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
