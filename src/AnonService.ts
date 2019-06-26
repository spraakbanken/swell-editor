import * as G from './Graph'
import * as Utils from './Utils'
import {Store} from 'reactive-lens'
import {Pseudonyms, is_anon_label} from './Editor/Anonymization'
import * as record from './record'

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
  graphStore.modify(g => {
    let si = 0 // Source tokens cursor
    const edges = toks.map((tok, i) => {
      const labels = tok.label.filter(is_anon_label)
      labels.length < tok.label.length && labels.unshift('extra')
      const token_ids = [g.source[si].id, g.target[si].id]
      si++
      if (labels.length && !toks[i + 1].label.length) {
        // Include subsequent tokens.
        while (g.source[si] && g.source[si].text.trim() != toks[i + 1].string.trim()) {
          token_ids.push(g.source[si].id, g.target[si].id)
          si++
        }
      }
      labels && pseudonymsStore.update({[labels.join(' ')]: tok.string})
      return G.Edge(token_ids, labels, !!labels.length)
    })
    return {...g, edges: record.init(edges.map(edge => ({k: edge.id, v: edge})))}
  })
}
