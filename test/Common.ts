import * as QC from 'proptest'
import {Gen} from 'proptest'

import 'mocha'

export const qc = QC.createProperty(it)

import * as enzyme from 'enzyme'
import * as Adapter from 'enzyme-adapter-react-16'

enzyme.configure({adapter: new Adapter()})

export {enzyme}

import * as R from 'ramda'
import * as G from '../src/Graph'
import {Graph} from '../src/Graph'
import * as Utils from '../src/Utils'

export const arrayOf = <A>(l: number, u: number, g: Gen<A>) =>
  QC.between(l, u).chain(i => g.replicate(i))
export const stringOf = (l: number, u: number, g: Gen<string>) =>
  arrayOf(l, u, g).map(s => s.join(''))

export const ws0 = stringOf(0, 3, QC.of(' '))
export const ws1 = stringOf(1, 3, QC.of(' '))
export const word = stringOf(1, 3, QC.lower)
export const str = stringOf(0, 3, QC.ascii)

export const token_text = QC.concat([ws0, word, ws1])

export const insert_text: Gen<string> = QC.concat([ws0, stringOf(0, 3, QC.ascii), ws0])

// Generate a random graph
export const graph_with_tokens = (token_text: Gen<string>): Gen<Graph> =>
  QC.pos
    .pow(2 / 3)
    .replicate(2)
    .chain(([ssize, tsize]) =>
      QC.between(1, Math.min(ssize, tsize)).chain(esize =>
        QC.record({
          source: token_text.replicate(ssize).map(xs => xs.map((text, i) => ({text, id: 's' + i}))),
          target: token_text.replicate(tsize).map(xs => xs.map((text, i) => ({text, id: 't' + i}))),
          proto_edges: arrayOf(0, 2, stringOf(1, 3, QC.upper))
            .replicate(esize)
            .map(xs => xs.map(labels => ({ids: [] as string[], labels}))),
          sedges: QC.permute(Utils.range(ssize).map(i => i % esize)),
          tedges: QC.permute(Utils.range(tsize).map(i => i % esize)),
        }).map(r => {
          const {source, target, proto_edges, sedges, tedges} = R.clone(r)
          source.forEach(s => proto_edges[sedges.pop() as number].ids.push(s.id))
          target.forEach(t => proto_edges[tedges.pop() as number].ids.push(t.id))
          return {
            source,
            target,
            edges: G.edge_record(proto_edges.map(e => G.Edge(e.ids, e.labels, true))),
          }
        })
      )
    )

export const graph = graph_with_tokens(token_text)

export const graph_one_space = graph_with_tokens(word.map(w => w + ' '))
