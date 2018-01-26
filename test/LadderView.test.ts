import * as R from 'ramda'

import * as G from '../src/Graph'
import * as RD from '../src/RichDiff'
import * as T from '../src/Token'
import * as L from '../src/LadderView'
import * as Utils from '../src/Utils'
import {show} from '../src/Utils'
import * as D from '../src/Diff'

import * as React from 'react'
import {shallow, configure} from 'enzyme'
import * as Adapter from 'enzyme-adapter-react-16'
import {test} from 'ava'

configure({adapter: new Adapter()})

test('ExampleSnapshot', t => {
  const g: G.Graph = {
    source: [
      {text: '1ag ', id: 's68'},
      {text: '2ar ', id: 's69'},
      {text: '3kt ', id: 's70'},
      {text: '4bb ', id: 's71'},
      {text: '5så ', id: 's72'},
      {text: ', ', id: 's73'},
      {text: '7as ', id: 's74'},
      {text: '8tt ', id: 's75'},
      {text: '9an ', id: 's76'},
      {text: '10ta ', id: 's77'},
      {text: '11ag ', id: 's78'},
      {text: '12ån ', id: 's79'},
      {text: '13bb ', id: 's80'},
      {text: '14er ', id: 's81'},
      {text: '15rn ', id: 's82'},
      {text: '16rs ', id: 's83'},
      {text: '17et ', id: 's84'},
      {text: '18li ', id: 's85'},
      {text: '19te ', id: 's86'},
      {text: '20ig ', id: 's87'},
      {text: '. ', id: 's88'},
    ],
    target: [
      {text: '1ag ', id: 't68'},
      {text: '2ar ', id: 't69'},
      {text: '3kt ', id: 't70'},
      {text: '4bb ', id: 't293'},
      {text: '5ch ', id: 't291'},
      {text: '6ag ', id: 't274'},
      {text: '7as ', id: 't275'},
      {text: '8tt ', id: 't75'},
      {text: '9ag ', id: 't78'},
      {text: '10an ', id: 't76'},
      {text: '11ta ', id: 't77'},
      {text: '12ot ', id: 't270'},
      {text: '13bb ', id: 't80'},
      {text: '14er ', id: 't81'},
      {text: '15en ', id: 't284'},
      {text: ', ', id: 't278'},
      {text: '16rs ', id: 't83'},
      {text: '17ir ', id: 't279'},
      {text: '18et ', id: 't84'},
      {text: '20gt ', id: 't281'},
      {text: '. ', id: 't88'},
    ],
    edges: {
      'e-t274-t275-s74': {
        ids: ['t274', 't275', 's74'],
        labels: ['M'],
        id: 'e-t274-t275-s74',
      },
      'e-s73': {ids: ['s73'], labels: ['R-PUNC'], id: 'e-s73'},
      'e-s78-t78': {ids: ['s78', 't78'], labels: ['OINV'], id: 'e-s78-t78'},
      'e-t270-s79': {
        ids: ['t270', 's79'],
        labels: ['F-AGR'],
        id: 'e-t270-s79',
      },
      'e-t279-s85': {
        ids: ['t279', 's85'],
        labels: ['F-TENSE'],
        id: 'e-t279-s85',
      },
      'e-s81-t81': {ids: ['s81', 't81'], labels: [], id: 'e-s81-t81'},
      'e-t293-s71-t291-s72': {
        ids: ['t293', 's71', 't291', 's72'],
        labels: [],
        id: 'e-t293-s71-t291-s72',
      },
      'e-s70-t70': {ids: ['s70', 't70'], labels: [], id: 'e-s70-t70'},
      'e-s80-t80': {ids: ['s80', 't80'], labels: [], id: 'e-s80-t80'},
      'e-s68-t68': {ids: ['s68', 't68'], labels: [], id: 'e-s68-t68'},
      'e-s69-t69': {ids: ['s69', 't69'], labels: [], id: 'e-s69-t69'},
      'e-t281-s86-s87': {
        ids: ['t281', 's86', 's87'],
        labels: ['F-AGR', 'SPL'],
        id: 'e-t281-s86-s87',
      },
      'e-s76-t76': {ids: ['s76', 't76'], labels: [], id: 'e-s76-t76'},
      'e-t284-t278-s82': {
        ids: ['t284', 't278', 's82'],
        labels: ['ORT', 'F'],
        id: 'e-t284-t278-s82',
      },
      'e-s75-t75': {ids: ['s75', 't75'], labels: [], id: 'e-s75-t75'},
      'e-s88-t88': {ids: ['s88', 't88'], labels: [], id: 'e-s88-t88'},
      'e-s83-t83': {ids: ['s83', 't83'], labels: [], id: 'e-s83-t83'},
      'e-s84-t84': {ids: ['s84', 't84'], labels: ['INV'], id: 'e-s84-t84'},
      'e-s77-t77': {ids: ['s77', 't77'], labels: [], id: 'e-s77-t77'},
    },
  }
  const d = G.calculate_diff(g)
  const rd = RD.enrichen(g, d)
  const grid = D.DiffToGrid(d)
  const dom = shallow(L.Ladder(g))

  function text_somewhere(s: string) {
    t.not(dom.findWhere(w => w.text() == s).length, 0, `Could not find DOM with text ${show(s)}`)
  }
  g.source.forEach(tok => text_somewhere(tok.text))
  g.target.forEach(tok => text_somewhere(tok.text))
  Utils.record_forEach(g.edges, e => e.labels.forEach(label => text_somewhere(label)))

  t.snapshot(show(d))
  t.snapshot(show(rd))
  t.snapshot(show(grid))
  t.snapshot(dom.debug())
})
