import * as G from './Graph/Graph'
import * as Utils from './Utils'
import {Store} from 'reactive-lens'
import {Pseudonyms} from './Editor/Anonymization'

const URL = 'https://ws.spraakbanken.gu.se/ws/larka/anon'

type AnonText = {string: string; label: string[]}[]

export function anonService(graphStore: Store<G.Graph>, pseudonymsStore: Store<Pseudonyms>): void {
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

      const em = G.edge_map(graph)
      toks.forEach((tok, i) => {
        const e = Utils.getUnsafe(em, graph.source[i].id)
        graph = G.modify_labels(graph, e.id, labels => [
          ...labels,
          ...tok.label.map(l => labelMap[l] || l),
        ])
        tok.label.length &&
          pseudonymsStore.update({[tok.label.map(l => labelMap[l] || l).join(' ')]: tok.string})
      })
      graphStore.set(graph)
    }
  )
}

// TODO: Temporary.
const labelMap: Record<string, string> = {
  city_name: 'city',
  fornamn_kvinna: 'firstname:female',
  fornamn_man: 'firstname:male',
}
