import * as G from './Graph/Graph'
import * as Utils from './Utils'
import {Store} from 'reactive-lens'
import {Pseudonyms, is_anon_label} from './Editor/Anonymization'

const URL = 'https://ws.spraakbanken.gu.se/ws/larka/pseuws'

type PseuwsText = {string: string; label: string[]}[]

export function anonService(
  graphStore: Store<G.Graph>,
  pseudonymsStore: Store<Pseudonyms>,
  handleError: (err: string) => void
): void {
  Utils.request(
    URL,
    {method: 'POST', data: `text=${encodeURIComponent(G.source_text(graphStore.get()))}`},
    response => {
      const toks: PseuwsText = [].concat(...JSON.parse(response))
      try {
        const {graph, pseudonyms} = applyPseuws(graphStore.get(), toks)
        pseudonymsStore.update(pseudonyms)
        graphStore.set(graph)
      } catch (e) {
        handleError(e)
      }
    }
  )
}

export function applyPseuws(graph: G.Graph, toks: PseuwsText) {
  if (toks.length != graph.source.length) {
    Utils.raise('Pseudonymizer result has wrong length')
  }

  const pseudonyms: Pseudonyms = {}
  const em = G.edge_map(graph)
  toks.forEach((tok, i) => {
    const clean_labels = tok.label.map(l => labelMap[l] || l).filter(is_anon_label)
    const e = Utils.getUnsafe(em, graph.source[i].id)
    graph = G.modify_labels(graph, e.id, labels => clean_labels)
    clean_labels && (pseudonyms[clean_labels.join(' ')] = tok.string)
  })

  return {graph, pseudonyms}
}

// TODO: Temporary.
const labelMap: Record<string, string> = {
  country_name: 'country',
  city_name: 'city',
  fornamn_kvinnor: 'firstname:female',
  fornamn_man: 'firstname:male',
}
