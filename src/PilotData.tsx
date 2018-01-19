import * as R from 'ramda'

import {GraphState} from './Model'
import * as G from './Graph'
import * as RD from './RichDiff'
import * as T from './Token'
import * as Utils from './Utils'

declare var window: any
declare var global: any
if (typeof window == 'undefined') {
  global.window = {}
}

declare const require: (json_file: string) => any
const files: Record<string, {graphs: Record<string, GraphState>}> = {
  beata: require('./data/beata/state.json'),
  elena: require('./data/elena/state.json'),
  gunlög: require('./data/gunlög/state.json'),
  julia: require('./data/julia/state.json'),
  lena: require('./data/lena/state.json'),
  mats: require('./data/mats/state.json'),
}
;(window as any).files = files

export const g = (annotator: string, text: string) => TryGetGraph({annotator, text}) as any
// console.log(G.sentences([
//   g('julia', 'text1').graph,
//   g('elena', 'text1').graph
// ]))
// console.log(G.sentences([
//   g('gunlög', 'text2').graph,
//   g('lena', 'text2').graph
// ]))
console.log(G.sentences(g('gunlög', 'text2').graph).map(s => s.source))
console.log(G.sentences(g('lena', 'text2').graph).map(s => s.source))
console.log(G.sentences(g('gunlög', 'text4').graph).map(s => s.source))
console.log(G.sentences(g('mats', 'text4').graph).map(s => s.source))
console.log(G.sentences(g('julia', 'text6').graph).map(s => s.source))
console.log(G.sentences(g('mats', 'text6').graph).map(s => s.source))

const s = Utils.merge_series(
  {
    julia: G.sentences(g('julia', 'text6').graph),
    mats: G.sentences(g('mats', 'text6').graph),
    beata: G.sentences(g('beata', 'text6').graph),
  },
  G.subspan_merge,
  R.eqProps('source')
)

s.forEach(s => console.log(s))

//    (a: G.Subspans, b: G.Subspans) => R.eq(R.equals(a.source

export function record_create<K extends string, A>(ks: K[], f: (k: K) => A): Record<K, A> {
  const obj = {} as Record<K, A>
  ks.forEach(k => (obj[k] = f(k)))
  return obj
}


export function imprint<A>(r: Record<string, Record<string, A>>, k1: string, k2: string, a: A) {
  if (! (k1 in r)) {
    r[k1] = {}
  }
  r[k1][k2] = a
}

export interface RichGraph {graph: G.Graph, rich_diff: RD.RichDiff[]}
export type RichGraphCount = RichGraph & {labelled: number}
export interface Metadata {annotator: string, text: string}
export const ByAnnotator: Record<string, Record<string, RichGraph>> = {}
export const ByText: Record<string, Record<string, RichGraph>> = {}

Object.entries(files).forEach(([annotator, {graphs}]) => {
  Object.entries(graphs).forEach(([text, {graph: {now: graph}}]) => {
    const {edges} = graph
    const labelled = Object.values(edges).filter((e: G.Edge) => e.labels.length > 0).length
    if (labelled > 0 && text != 'examples') {
      const rich_graph = {graph, rich_diff: RD.enrichen(graph, G.calculate_diff(graph)), labelled}
      imprint(ByAnnotator, annotator, text, rich_graph)
      imprint(ByText, text, annotator, rich_graph)
    }
  })
})

export type GraphSegments = ({subspan: Subspans} & Metadata & RichGraph)[]

export function Calculate(text: string): GraphSegments  {
  const graphs = ByText[text]
  const groups = G.sentence_groups(Utils.record_map(graphs, rg => rg.graph))
  return Utils.flatten(
    groups.map(group =>
      Utils.record_traverse(group, (subspan, annotator) => {
      const graph = G.subgraph(graphs[annotator].graph, subspan)
      return {subspan, annotator, text, graph, rich_diff: RD.enrichen(graph, G.calculate_diff(graph))}
    })
  ))
}

console.log(Utils.show(Calculate('text1')))

export function TryGetGraph(state: {
  annotator: string
  text: string
}): {ok: false; msg: string} | {ok: true; graph: G.Graph; rich_diff: RD.RichDiff[]} {
  try {
    const graph = files[state.annotator].graphs[state.text].graph.now
    const rich_diff = RD.enrichen(graph, G.calculate_diff(graph))
    return {ok: true, graph, rich_diff}
  } catch (e) {
    return {ok: false, msg: e.toString()}
  }
}

export function GetGraph(state: {
  annotator: string
  text: string
}): {graph: G.Graph; rich_diff: RD.RichDiff[]} {
  const r = TryGetGraph(state)
  if (r.ok) {
    return r
  } else {
    throw msg
  }
}

