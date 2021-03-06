import {enzyme, graph, qc} from './Common'

import * as GV from '../src/GraphView'
import * as Utils from '../src/Utils'
import * as record from '../src/record'
import * as ReactUtils from '../src/ReactUtils'

qc('GraphView text sanity', graph.small(), (g, p) => {
  const dom = enzyme.shallow(GV.graphView(g))

  function text_somewhere(s: string) {
    function go(node: enzyme.ShallowWrapper): boolean {
      if (node.is(ReactUtils.Thunk)) {
        return go(node.dive())
      }
      return node.children().someWhere(w => node.text().trimRight() == s.trimRight() || go(w))
    }
    if (!go(dom)) {
      p.fail(`Could not find DOM with text ${Utils.show(s)}`)
    }
  }
  g.source.forEach(tok => text_somewhere(tok.text))
  g.target.forEach(tok => text_somewhere(tok.text))
  record.forEach(g.edges, e => e.labels.forEach(label => text_somewhere(label)))
  return true
})

/*
import * as R from 'ramda'
import * as G from '../src/Graph'
import * as RD from '../src/RichDiff'
import * as T from '../src/Token'
import * as D from '../src/Diff'


function snap_attempt() {
  const snap: (t: test.Test, x: any) => void = require('assert-snapshot')

  test('snap', t => {
    const g = graph.sample(5, 404)
    Utils.stderr(g)
    const d = G.calculate_diff(g)
    const rd = RD.enrichen(g, d)
    const grid = D.DiffToGrid(d)
    const dom = shallow(GV.GraphView(g)).html()
    snap(t, Utils.show({g,d,rd,grid}) + '\n' + dom)
    t.end()
  })
}

*/
