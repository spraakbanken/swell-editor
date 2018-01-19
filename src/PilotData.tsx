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

export function record_create<K extends string, A>(ks: K[], f: (k: K) => A): Record<K, A> {
  const obj = {} as Record<K, A>
  ks.forEach(k => (obj[k] = f(k)))
  return obj
}

export const Edited: {annotator: string; text: string; labelled: number}[] = []
Object.entries(files).forEach(([annotator, {graphs}]) => {
  Object.entries(graphs).forEach(([text, {graph: {now: {edges}}}]) => {
    const labelled = Object.values(edges).filter((e: G.Edge) => e.labels.length > 0).length
    if (labelled > 0 && text != 'examples') {
      Edited.push({annotator, text, labelled})
    }
  })
})
Edited.sort((x, y) => x.text.localeCompare(y.text))
export const Edits = R.groupBy(x => x.text, Edited)
export const SentenceGroups = (text: string) =>
    G.sentence_groups(
      R.fromPairs(
        Edits[text].map(
        st => [st.annotator, GetGraph(st).graph] as [string, G.Graph])))

console.log(Edits)
console.log(Utils.show(SentenceGroups('text1')))
