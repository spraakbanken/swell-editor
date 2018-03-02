import * as QC from 'ts-quickcheck'
import {Gen} from 'ts-quickcheck'
import * as test from 'tape'
export const qc = QC.tape_adapter(test)
export {test, Gen, QC}

import * as enzyme from 'enzyme'
import * as Adapter from 'enzyme-adapter-react-16'

enzyme.configure({adapter: new Adapter()})

export {enzyme}

import * as R from 'ramda'
import * as G from '../src/Graph'
import {Graph} from '../src/Graph'
import * as Utils from '../src/Utils'

export const aof = <A>(l: number, u: number, g: Gen<A>) =>
  Gen.between(l, u).then(i => g.replicate(i))
export const sof = (l: number, u: number, g: Gen<string>) => aof(l, u, g).map(s => s.join(''))

export const ws0 = sof(0, 3, Gen.pure(' '))
export const ws1 = sof(1, 3, Gen.pure(' '))
export const word = sof(1, 3, Gen.lower)
export const str = sof(0, 3, Gen.ascii)

export const token_text = Gen.concat([ws0, word, ws1])

export const insert_text: Gen<string> = Gen.concat([ws0, sof(0, 3, Gen.ascii), ws0])

// Generate a random graph
export const graph: Gen<Graph> = Gen.size()
  .then(i => Gen.between(1, 2 + Math.round(i / 10)))
  .replicate(2)
  .then(([ssize, tsize]) =>
    Gen.between(1, 1 + Math.min(ssize, tsize)).then(esize =>
      Gen.record({
        source: token_text.replicate(ssize).map(xs => xs.map((text, i) => ({text, id: 's' + i}))),
        target: token_text.replicate(tsize).map(xs => xs.map((text, i) => ({text, id: 't' + i}))),
        proto_edges: aof(0, 2, sof(1, 3, Gen.upper))
          .replicate(esize)
          .map(xs => xs.map(labels => ({ids: [] as string[], labels}))),
        sedges: Gen.permute(Utils.range(ssize).map(i => i % esize)),
        tedges: Gen.permute(Utils.range(tsize).map(i => i % esize)),
      }).map(r => {
        const {source, target, proto_edges, sedges, tedges} = R.clone(r)
        source.forEach(s => proto_edges[sedges.pop() as number].ids.push(s.id))
        target.forEach(t => proto_edges[tedges.pop() as number].ids.push(t.id))
        return {source, target, edges: G.edge_record(proto_edges.map(e => G.Edge(e.ids, e.labels)))}
      })
    )
  )
