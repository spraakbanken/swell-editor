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
        applyPseuws(graphStore, pseudonymsStore, toks)
      } catch (e) {
        handleError(e)
      }
    },
    (response, code) => {
      code
        ? handleError(`Pseudonymizer error ${code}: ${response}`)
        : handleError('Pseudonymizer error')
    }
  )
}

export function applyPseuws(
  graphStore: Store<G.Graph>,
  pseudonymsStore: Store<Pseudonyms>,
  toks: PseuwsText
) {
  toks.length == graphStore.get().source.length ||
    Utils.raise('Pseudonymizer result has different length than input; tokenization problem?')

  toks.forEach((tok, i) => {
    const clean_labels = tok.label.filter(is_anon_label)
    clean_labels.length < tok.label.length && clean_labels.unshift('extra')
    const edge = G.edge_at(graphStore.get(), i, 'source')
    const edgeStore = G.edge_store(graphStore, edge.id)
    edgeStore.modify(e => ({...e, labels: clean_labels, manual: !!clean_labels.length}))
    clean_labels && pseudonymsStore.update({[clean_labels.join(' ')]: tok.string})
  })
}
