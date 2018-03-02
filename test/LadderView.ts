import {QC, test, qc, Gen} from './Common'
import {graph, insert_text} from './Common'
import {enzyme} from './Common'

import * as L from '../src/LadderView'
import * as Utils from '../src/Utils'

qc(
  'Ladder text sanity',
  graph,
  (g, p) => {
    const dom = enzyme.shallow(L.Ladder(g))

    function text_somewhere(s: string) {
      if (dom.findWhere(w => w.text() == s).length === 0) {
        p.fail(`Could not find DOM with text ${Utils.show(s)}`)
      }
    }
    g.source.forEach(tok => text_somewhere(tok.text))
    g.target.forEach(tok => text_somewhere(tok.text))
    Utils.record_forEach(g.edges, e => e.labels.forEach(label => text_somewhere(label)))
    return true
  },
  QC.verbose
)

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
    const dom = shallow(L.Ladder(g)).html()
    snap(t, Utils.show({g,d,rd,grid}) + '\n' + dom)
    t.end()
  })
}

*/
