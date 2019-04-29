import * as G from '../Graph'
import * as record from '../record'
import * as Utils from '../Utils'
import {label_sort, taxonomy_has_label} from './Config'
import {pseudonymize} from 'pseudonymization'
import {Store} from 'reactive-lens'

export type Pseudonyms = Record<string, string>

export function is_anon_label(label: string): boolean {
  return (
    !isNaN(Number(label)) ||
    (taxonomy_has_label('anonymization', label) && !G.is_comment_label(label))
  )
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
    const st = partition(edge.ids)
    // Add the target text for each label combination.
    out[sort_anon_labels(edge.labels).join(' ')] = G.target_text(st)
  })
  return out
}

/**  Replaces the target tokens of anonymization-labeled edges with pseudonymizations.

  const g0 = G.init('Sweden Suiden and Denmark')
  const g1 = G.modify_labels(g0, 'e-s0-t0', () => ['country', '1'])
  const g2 = G.modify_labels(g1, 'e-s1-t1', () => ['country', '1'])
  const g3 = G.modify_labels(g2, 'e-s2-t2', () => ['foobar'])
  const g = G.modify_labels(g3, 'e-s3-t3', () => ['country', '2'])
  const pstore = Store.init({}) as Store<Record<string, string>>
  const p = anonymize(g, pstore)
  const ptexts = G.target_texts(p)
  ptexts[1] === ptexts[0] // => true
  ptexts[2]               // => 'and '
  ptexts[3] !== ptexts[0] // => true
  Utils.shallow_array_eq(g.source, p.source) // => true
*/
export function anonymize(graph: G.Graph, pstore: Store<Pseudonyms>): G.Graph {
  const g = G.clone(graph)
  let i = G.next_id(g)
  const em = G.edge_map(g)
  const first = Utils.unique_check<string>()
  const pi = G.partition_ids(g)
  const target: G.Token[] = []
  const edges: G.Edge[] = []
  g.source.forEach(source_token => {
    const e = Utils.getUnsafe(em, source_token.id)
    // If the edge has anon labels.
    const anonLabels = sort_anon_labels(e.labels)
    if (!first(e.id)) {
      return
    }
    if (anonLabels.length) {
      const source_text = G.text(pi(e.ids).source)
      // Ensure a pseudonymization in the store.
      const pp = pstore.at(anonLabels.join(' '))
      if (pp.get() === undefined) pp.set(pseudonymize(source_text, anonLabels))
      const ts = G.tokenize(pp.get()).map(text => G.Token(Utils.end_with_space(text), 't' + i++))
      edges.push(
        G.Edge(
          [...pi(e.ids).source.map(s => s.id), ...ts.map(t => t.id)],
          e.labels,
          true,
          e.comment
        )
      )
      ts.forEach(t => target.push(t))
    } else {
      edges.push(e)
      target.push(...pi(e.ids).target)
    }
  })
  return {
    ...G.clone(g),
    source: g.source,
    target,
    edges: G.edge_record(edges),
  }
}

export function anonymize_when(
  b?: boolean
): (graph: G.Graph, pstore: Store<Pseudonyms>) => G.Graph {
  return (graph, pstore) => (b ? anonymize(graph, pstore) : graph)
}

/** Apply anonymization fix-up, by copying new pseudonymizations to source. */
export function anonfixGraph(graph: G.Graph) {
  let g = G.clone(graph)
  const p = G.partition_ids(g)
  const tm = G.token_map(g)
  // For new anonymizations, overwrite source with pseudonymized target.
  record.forEach(record.filter(g.edges, e => e.labels.some(is_anon_label)), (edge, eid) => {
    const st = p(edge.ids)
    // If source and target differ, this is a new anonymization.
    if (!Utils.shallow_array_eq(G.source_texts(st), G.target_texts(st))) {
      // Replace the first token with the pseudonymization.
      const first_source_token = st.source.shift()
      if (first_source_token === undefined) {
        return
      }
      const i = Utils.getUnsafe(tm, first_source_token.id).index
      g = G.modify_tokens(g, i, i + 1, G.target_text(st), 'source')
      // Remove any subsequent tokens (e.g. "Park Road" in "Glenister Park Road").
      // Go backwards to keep indexes safe.
      st.source.reverse().forEach(t => {
        const i = Utils.getUnsafe(tm, t.id).index
        g = G.modify_tokens(g, i, i + 1, '', 'source')
      })
    } else {
    }
  })
  return g
}
