import * as R from 'ramda'

import {GraphState} from './Model'
import * as D from './Diff'
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
const pilot_data: Record<
  string,
  {graphs: Record<string, GraphState>}
> = require('../pilot_data.json')

export type Ok<A> = {ok: false; msg: string} | ({ok: true} & A)

export function ok<A>(v: Ok<A>): A {
  if (v.ok) {
    return v
  } else {
    throw v.msg
  }
}

export function Try<A>(k: () => A): Ok<A> {
  try {
    return {ok: true, ...(k() as any)}
  } catch (e) {
    throw {ok: false, msg: e.toString()}
  }
}

export function imprint<A>(r: Record<string, Record<string, A>>, k1: string, k2: string, a: A) {
  if (!(k1 in r)) {
    r[k1] = {}
  }
  r[k1][k2] = a
}

export interface RichGraph {
  graph: G.Graph
  rich_diff: RD.RichDiff[]
}
export interface Labelled {
  labelled: number
}
export interface Metadata {
  annotator: string
  text: string
}
export const ByAnnotator: Record<string, Record<string, RichGraph & Labelled>> = {}
export const ByText: Record<string, Record<string, RichGraph & Labelled>> = {}
export const Edited: (Metadata & Labelled & RichGraph)[] = []

Object.entries(pilot_data).forEach(([annotator, {graphs}]) => {
  Object.entries(graphs).forEach(([text, {graph: {now: graph}}]) => {
    const {edges} = graph
    const labelled = Object.values(edges).filter((e: G.Edge) => e.labels.length > 0).length
    if (
      labelled > 0 &&
      text != 'examples' &&
      (text != 'text3' || (annotator != 'gunlög' && annotator != 'lena'))
    ) {
      const rich_graph = {graph, rich_diff: RD.enrichen(graph), labelled}
      imprint(ByAnnotator, annotator, text, rich_graph)
      imprint(ByText, text, annotator, rich_graph)
      Edited.push({text, annotator, ...rich_graph})
    }
  })
})

export const GetGraph = ({annotator, text}: Metadata) => ByAnnotator[annotator][text]

export const TryGetGraph = (metadata: Metadata) => Try(() => GetGraph(metadata))

export type GraphSegments = ({subspan: G.Subspan} & Metadata & RichGraph)[]

export function GraphSegments(text: string): GraphSegments {
  const graphs = ByText[text]
  const groups = G.sentence_groups(Utils.record_map(graphs, rg => rg.graph))
  return Utils.flatten(
    groups.map(group =>
      Utils.record_traverse(group, (subspan, annotator) => {
        const graph = G.subgraph(graphs[annotator].graph, subspan)
        return {subspan, annotator, text, graph, rich_diff: RD.enrichen(graph)}
      })
    )
  )
}

function pluck(...keys: string[]): (x: Record<string, any>) => Record<string, any> {
  return x => Utils.record_filter(x, (_, k) => keys.some(o => k == o))
}
// const mats = GraphSegments('text6')[17].rich_diff
// const plucked = mats.map(pluck('edit', 'id', 'source', 'target'))
// console.log(Utils.show(plucked))
// const pls = D.ProtoLines(mats, 'Dropped')
// console.log(Utils.show(pls))
// const lines = D.Grid(pls, mats.length)
// console.log(Utils.show(lines))
