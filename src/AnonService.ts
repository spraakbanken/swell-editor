import {Store} from 'reactive-lens'
import * as G from './Graph/Graph'
import * as Utils from './Utils'
import {string_to_data} from './EditorTypes'
import * as record from './record'

const URL = 'https://ws.spraakbanken.gu.se/ws/larka/anon'

type AnonText = {string: string; label: string[]}[]

export function anonService(graphStore: Store<G.Graph>): void {
  let graph = graphStore.get()
  Utils.request(
    URL,
    {method: 'POST', data: `text=${encodeURIComponent(G.source_text(graph))}`},
    response => {
      const toks: AnonText = [].concat(...JSON.parse(response))
      if (toks.length != graph.source.length) {
        console.error(toks.length, toks)
        Utils.raise('Pseudonymizer result has wrong length')
      }

      // graph = {
      //   ...graph,
      //   target: graph.target.map((t, i) => ({...t, text: Utils.end_with_space(toks[i].string)})),
      //   edges: record.map(graph.edges, (e, id) => ({...e, manual: true})),
      // }

      // const em = G.edge_map(graph)
      // toks.forEach((tok, i) => {
      // const e = Utils.getUnsafe(em, graph.source[i].id)
      // graph = G.modify_labels(graph, e.id, labels => [...labels, ...tok.label])
      // })
      console.log(graph)
      graphStore.set(graph)
    }
  )
}
