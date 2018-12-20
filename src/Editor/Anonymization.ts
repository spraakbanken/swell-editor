import * as G from '../Graph'
import * as record from '../record'
import * as Utils from '../Utils'
import {label_taxonomy, label_sort} from './Config'
import {pseudonymize} from 'pseudonymization'
import {Store} from 'reactive-lens'

export type Pseudonyms = Record<string, string>

export function is_anon_label(label: string): boolean {
  return label_taxonomy(label) === 'anonymization'
}

export function sort_anon_labels(labels: string[]): string[] {
  return labels.filter(is_anon_label).sort(label_sort)
}

/** Create a pseudonymization store from current target texts. */
export function init_pstore(graph: G.Graph): Pseudonyms {
  const partition = G.partition_ids(graph)
  const out: Pseudonyms = {}
  // Go through anonymized edges.
  record.forEach(record.filter(graph.edges, e => e.labels.some(is_anon_label)), edge => {
    const st = partition(edge)
    // Add the target text for each label combination.
    out[sort_anon_labels(edge.labels).join(' ')] = G.target_text(st)
  })
  return out
}

/** Ignores the target text completly, only looks at the source tokens and their
edge groups and copies them to target if there is no label, otherwise replaces them
with a pseudonym.

Source ids are preserved but target ids are generated.

  const pstore = Store.init({}) as Store<Record<string, string>>
  const ptexts = G.target_texts(anonymize(G.from_unaligned({
    source: [
      {text: 'Sweden ', labels: ['country', '1']},
      {text: 'Sweden ', labels: ['country', '1']},
      {text: 'and ', labels: ['foobar']},
      {text: 'Denmark ', labels: ['country', '2']},
    ],
    target: []
  }), pstore))
  ptexts[1] === ptexts[0] // => true
  ptexts[2]               // => 'and '
  ptexts[3] !== ptexts[0] // => true

TODO: Try replacing source_to_target with clone. Helps with labels and word order in anonfix?
*/
export function anonymize(graph: G.Graph, pstore: Store<Pseudonyms>): G.Graph {
  const g = G.source_to_target(graph, false)
  let i = G.next_id(g)
  const em = G.edge_map(g)
  const tm = G.token_map(g)
  const first = Utils.unique_check<string>()
  const ps = pseudonymizer(pstore)
  const edges: G.Edge[] = []
  const target: G.Token[] = Utils.flatMap(g.target, t => {
    const e = Utils.getUnsafe(em, t.id)
    // If the edge has anon labels.
    if (e.labels.filter(is_anon_label).length) {
      if (first(e.id)) {
        const source_ids = e.ids.filter(i => Utils.getUnsafe(tm, i).side == 'source')
        const source_text = G.text(g.source.filter(s => source_ids.includes(s.id)))
        const pn = Utils.end_with_space(ps(source_text, e.labels))
        const target = G.Token(pn, 't' + i++)
        edges.push(G.Edge([...source_ids, target.id], e.labels, true))
        return [target]
      } else {
        return []
      }
    } else {
      if (first(e.id)) {
        edges.push(e)
      }
      return [t]
    }
  })
  return {source: g.source, target, edges: G.edge_record(edges)}
}

export function anonymize_when(
  b?: boolean
): (graph: G.Graph, pstore: Store<Pseudonyms>) => G.Graph {
  return (graph, pstore) => (b ? anonymize(graph, pstore) : graph)
}

/** Makes a pseudonymize function with memory. */
export function pseudonymizer(store: Store<Pseudonyms>) {
  return (text: string, labels: string[]) => {
    const anonLabels = sort_anon_labels(labels)
    const store_key = anonLabels.join(' ')
    const ps = store.get()
    if (ps[store_key] === undefined)
      store.modify(ps => ({...ps, [store_key]: pseudonymize(text, anonLabels)}))
    return store.at(store_key).get()
  }
}

/** Apply anonymization fix-up, by copying new pseudonymizations to source. */
export function anonfixGraph(graph: G.Graph) {
  let g = G.clone(graph)
  const p = G.partition_ids(g)
  const tm = G.token_map(g)
  // For new anonymizations, overwrite source with pseudonymized target.
  record.forEach(record.filter(g.edges, e => e.labels.some(is_anon_label)), (edge, eid) => {
    const st = p(edge)
    // If source and target differ, this is a new anonymization.
    if (!Utils.shallow_array_eq(G.source_texts(st), G.target_texts(st))) {
      // Replace the first token with the pseudonymization.
      const first_source_token = st.source.shift()
      if (first_source_token === undefined) {
        return
      }
      const i = tm.get(first_source_token.id)!.index
      g = G.modify_tokens(g, i, i + 1, G.target_text(st), 'source')
      // Remove any subsequent tokens (e.g. "Park Road" in "Glenister Park Road").
      // Go backwards to keep indexes safe.
      st.source.reverse().forEach(t => {
        const i = tm.get(t.id)!.index
        g = G.modify_tokens(g, i, i + 1, '', 'source')
      })
    } else {
    }
  })
  return g
}
