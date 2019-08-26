/** Parallel corpus as a graph */
import * as R from 'ramda'
import * as Utils from '../Utils'
import * as record from '../record'
import {Token, Span} from './Token'
import * as T from './Token'
import {Lens, Store} from 'reactive-lens'

import * as D from './Diff'

export type Side = 'source' | 'target'

export const opposite = (s: Side): Side => (s === 'source' ? 'target' : 'source')

export const sides = ['source', 'target'] as Side[]

export const sidecase = <T>(side: Side, s: T, t: T): T => (side === 'source' ? s : t)

export function mapSides<A, B>(g: SourceTarget<A>, f: (a: A, side: Side) => B): SourceTarget<B> {
  return {source: f(g.source, 'source'), target: f(g.target, 'target')}
}

export interface SourceTarget<A> {
  readonly source: A
  readonly target: A
}

export interface Graph extends SourceTarget<Token[]> {
  readonly edges: Edges
  readonly comment?: string
}

export type Edges = Record<string, Edge>

export interface Edge {
  /** a copy of the identifier used in the edges object of the graph */
  readonly id: string
  /** these are ids to source and target tokens */
  readonly ids: string[]
  /** labels on this edge */
  readonly labels: string[]
  /** is this manually or automatically aligned */
  readonly manual: boolean
  readonly comment?: string
}

export function Edge(ids: string[], labels: string[], manual = false, comment?: string): Edge {
  const ids_sorted = ids.sort()
  const labels_nub = Utils.uniq(labels)
  return {
    id: 'e-' + ids_sorted.join('-'),
    ids: ids_sorted,
    labels: labels_nub,
    manual,
    ...(comment && labels_nub.some(is_comment_label) ? {comment} : {}),
  }
}

export function merge_edges(...es: Edge[]) {
  return Edge(
    Utils.flatMap(es, e => e.ids),
    Utils.flatMap(es, e => e.labels),
    es.some(e => !!e.manual),
    Utils.uniq(es.map(e => e.comment).filter(Boolean) as string[]).join('\n\n')
  )
}

export const zero_edge = merge_edges()

export function edge_record(es: Edge[]): Record<string, Edge> {
  const out = {} as Record<string, Edge>
  es.forEach(e => (out[e.id] = e))
  return out
}

/** Checks that the invariant of the graph holds

  check_invariant(init('apa bepa cepa')) // => 'ok'

  const g0 = init('apa')
  const g = {...g0, edges: {'oops': g0.edges['e-s0-t0']}}
  check_invariant(g) !== 'ok' // => true

*/
export function check_invariant(g: Graph): 'ok' | {violation: string; g: Graph} {
  try {
    const tokens = g.source.concat(g.target)
    {
      const unique_id = Utils.unique_check<string>()
      tokens.forEach(t => unique_id(t.id) || Utils.raise('Duplicate id: ' + t))
      record.forEach(
        g.edges,
        e => unique_id(e.id) || Utils.raise('Duplicate id from edges: ' + e.id)
      )
    }
    const check_tokens = (toks: string[]) => {
      if (toks.length == 1) {
        const t = toks[0]
        t.match(/^\s*\S*\s*$/) || Utils.raise('Bad single token: ' + JSON.stringify(t))
      } else {
        toks.forEach(
          (t, i) => t.match(/^\s*\S+\s+$/) || Utils.raise('Bad text token: ' + JSON.stringify(t))
        )
      }
    }
    check_tokens(target_texts(g))
    check_tokens(source_texts(g))
    record.forEach(
      g.edges,
      (e, id) =>
        e.id === id || Utils.raise(`Edge key and id do not match: ${id} and ${Utils.show(e)}`)
    )
    record.forEach(
      g.edges,
      e =>
        e.ids.length > 0 || Utils.raise(`Edge without any associated identifiers ${Utils.show(e)}`)
    )
    record.forEach(
      g.edges,
      e =>
        !e.comment ||
        e.labels.some(is_comment_label) ||
        Utils.raise(`Edge with comment but no comment label: ${Utils.show(e)}`)
    )
    record.forEach(
      g.edges,
      e => R.equals(e, merge_edges(e)) || Utils.raise(`Edge not in normal form: ${Utils.show(e)}`)
    )
    {
      const token_ids = new Set(tokens.map(t => t.id))
      record.forEach(g.edges, e =>
        e.ids.forEach(id => {
          token_ids.has(id) || Utils.raise(`Edge ${Utils.show(e)} refers to unknown token ${id}`)
        })
      )
    }
    {
      const token_count = Utils.count<string>()
      record.forEach(g.edges, e => e.ids.forEach(id => token_count.inc(id)))
      tokens.forEach(tok => {
        const n = token_count.get(tok.id)
        n == 1 || Utils.raise('Token not appearing exactly once in edge lists: ' + tok.id)
      })
    }
    R.equals(g, align(g)) || Utils.raise('Graph not automatically aligned')
    g.comment !== '' || Utils.raise('Graph comment must not be empty string')
    record.forEach(
      g.edges,
      e => e.comment !== '' || Utils.raise('Edge comment must not be empty string')
    )
  } catch (e) {
    // console.error(e)
    // console.error(JSON.stringify(g, undefined, 2))
    return {violation: e.toString(), g}
  }
  return 'ok'
}

/** Makes spans from an original text by tokenizing it and assumes no changes

  const g = init('w1 w2')
  const source = [{text: 'w1 ', id: 's0'}, {text: 'w2 ', id: 's1'}]
  const target = [{text: 'w1 ', id: 't0'}, {text: 'w2 ', id: 't1'}]
  const edges = edge_record([Edge(['s0', 't0'], []), Edge(['s1', 't1'], [])])
  g // => {source, target, edges}

*/
export function init(s: string, manual = false): Graph {
  return init_from(T.tokenize(s), manual)
}

/** Makes a graph from tokens */
export function init_from(tokens: string[], manual = false): Graph {
  return align({
    source: T.identify(tokens, 's'),
    target: T.identify(tokens, 't'),
    edges: edge_record(tokens.map((_, i) => Edge(['s' + i, 't' + i], [], manual))),
  })
}

export function empty(g: Graph): boolean {
  return !g.source.length || !g.target.length
}

/** Change or remove the graph-wide comment.

  const g0 = init('apa bepa')
  const g1 = set_comment(g0, 'foo')
  g1.comment // => 'foo'
  const g2 = set_comment(g1)
  g2.comment // => undefined
  const g3 = set_comment(g1, '')
  g3.comment // => undefined
 */
export function set_comment(g: Graph, c?: string): Graph {
  return c ? {...g, comment: c} : {source: g.source, target: g.target, edges: g.edges}
}

/** Clone a graph

  const g = init('apa bepa')
  const g2 = clone(g)                       // => g
  g2 == g                                   // => false
  g2.source == g.source                     // => false
  g2.edges['e-s0-t0'] == g.edges['e-s0-t0'] // => false

 */
export function clone(graph: Graph): Graph {
  return {
    source: graph.source.map(x => x),
    target: graph.target.map(x => x),
    edges: record.map(graph.edges, x => ({...x})),
    ...(graph.comment ? {comment: graph.comment} : {}),
  }
}

/** Initialize a graph from unaligned tokens

  from_unaligned({
    source: [{text: 'apa ', labels: []}],
    target: [{text: 'apa ', labels: []}]
  }) // => init('apa')
  equal(from_unaligned({
    source: [{text: 'apa ', labels: []}],
    target: [{text: 'bepa ', labels: []}]
  }), set_target(init('apa'), 'bepa ')) // => true

*/
export function from_unaligned(st: SourceTarget<{text: string; labels: string[]}[]>): Graph {
  const edges: Record<string, Edge> = {}
  const g = mapSides(st, (toks, side) =>
    toks.map((tok, i) => {
      const id = side[0] + i
      const e = Edge([id], tok.labels, false)
      edges[id] = e
      return T.Token(tok.text, id)
    })
  )
  return align({...g, edges})
}

/** Map from token ids to edges

  const g = init('w')
  const e = Edge(['s0', 't0'], [])
  const lhs = [...edge_map(g).entries()]
  const rhs = [['s0', e], ['t0', e]]
  lhs // => rhs

*/
export function edge_map(g: Graph): Map<string, Edge> {
  return new Map(
    Utils.flatten(record.traverse(g.edges, e => e.ids.map(id => [id, e] as [string, Edge])))
  )
}

/** The edges from a set of ids

  const g = init('w')
  token_ids_to_edges(g, ['s0']) // => Object.values(g.edges)
  token_ids_to_edges(g, ['t0']) // => Object.values(g.edges)
  token_ids_to_edges(g, ['s0', 't0']) // => Object.values(g.edges)

*/
export function token_ids_to_edges(g: Graph, ids: string[]): Edge[] {
  const em = edge_map(g)
  const out: Edge[] = []
  const first = Utils.unique_check<string>()
  ids.forEach(id => {
    const e = em.get(id)
    if (e && first(e.id)) {
      out.push(e)
    }
  })
  return out
}

export function token_ids_to_edge_ids(g: Graph, ids: string[]): string[] {
  return token_ids_to_edges(g, ids).map(e => e.id)
}

/** Find tokens by token ids and split by source or target.

  const g = init('a b c')
  const source = [g.source[1], g.source[2]]
  const target = [g.target[1], g.target[0]]
  partition_ids(g)(['s1', 't1', 's2', 't0']) // => {source, target}

*/
export function partition_ids(g: Graph): (ids: string[]) => SourceTarget<Token[]> {
  const sm = source_map(g)
  const tm = target_map(g)
  return ids => {
    const source = [] as Token[]
    const target = [] as Token[]
    ids.forEach(id => {
      const s = sm.get(id)
      if (s !== undefined) {
        source.push(g.source[s])
      }
      const t = tm.get(id)
      if (t !== undefined) {
        target.push(g.target[t])
      }
    })
    return {source, target}
  }
}

export type SidedIndex = {side: Side; index: number}

/** Map from token identifiers to sided offsets

  const g = init('a b c')
  const m = token_map(g)
  m.get('s0') // => {side: 'source', index: 0}
  m.get('s1') // => {side: 'source', index: 1}
  m.get('t0') // => {side: 'target', index: 0}

*/
export function token_map(g: Graph): Map<string, SidedIndex> {
  const m = mapSides(g, (tokens, side) =>
    tokens.map((token, index) => [token.id, {side, index}] as [string, SidedIndex])
  )
  return new Map([...m.source, ...m.target])
}

/** Map from source identifiers to offsets

  const g = init('a b c')
  const m = source_map(g)
  m.get('s0') // => 0
  m.get('s1') // => 1
  m.has('t0') // => false

*/
export function source_map(g: SourceTarget<Token[]>): Map<string, number> {
  return new Map(g.source.map((s, i) => [s.id, i] as [string, number]))
}

/** Map from target identifiers to offsets

  const g = init('a b c')
  const m = target_map(g)
  m.get('t0') // => 0
  m.get('t1') // => 1
  m.has('s0') // => false

*/
export function target_map(g: SourceTarget<Token[]>): Map<string, number> {
  return new Map(g.target.map((t, i) => [t.id, i] as [string, number]))
}

/** The edge at a position (in the target text)

  const g = init('apa bepa cepa')
  edge_at(g, 1) // => Edge(['s1', 't1'], [])

*/
export function edge_at(g: Graph, index: number, side: Side = 'target'): Edge {
  const token_id = g[side][index].id
  return edge_map(g).get(token_id) || Utils.raise('Out of bounds: ' + JSON.stringify({g, index}))
}

/** The related ids at a position (in the target text)

  const g = init('apa bepa cepa')
  related(g, 1) // => ['s1', 't1']

*/
export function related(g: Graph, index: number): string[] {
  return edge_at(g, index).ids
}

/** The text in the target

  target_text(init('apa bepa cepa ')) // => 'apa bepa cepa '

*/
export function target_text(g: SourceTarget<T.Text[]>): string {
  return T.text(g.target)
}

/** The text in the source

  source_text(init('apa bepa cepa ')) // => 'apa bepa cepa '

*/
export function source_text(g: SourceTarget<T.Text[]>): string {
  return T.text(g.source)
}

/** The texts in the target

  target_texts(init('apa bepa cepa ')) // => ['apa ', 'bepa ', 'cepa ']

*/
export function target_texts(g: SourceTarget<T.Text[]>): string[] {
  return T.texts(g.target)
}

/** The texts in the source

  source_texts(init('apa bepa cepa ')) // => ['apa ', 'bepa ', 'cepa ']

*/
export function source_texts(g: SourceTarget<T.Text[]>): string[] {
  return T.texts(g.source)
}

/** The next free unique id

  next_id(init('apa')) // => 1

*/
export function next_id(g: Graph): number {
  return Utils.next_id([...g.target.map(t => t.id), ...g.source.map(t => t.id)])
}

/** Replace the text at some position, merging the spans it touches upon.

  const show = (g: Graph) => g.target.map(t => t.text)
  const ids = (g: Graph) => g.target.map(t => t.id).join(' ')
  const g = init('test graph hello')
  show(g) // => ['test ', 'graph ', 'hello ']
  show(unaligned_modify(g, 0, 0, 'new')) // => ['newtest ', 'graph ', 'hello ']
  show(unaligned_modify(g, 0, 1, 'new')) // => ['newest ', 'graph ', 'hello ']
  show(unaligned_modify(g, 0, 5, 'new ')) // => ['new ', 'graph ', 'hello ']
  show(unaligned_modify(g, 0, 5, 'new')) // => ['newgraph ', 'hello ']
  show(unaligned_modify(g, 5, 5, ' ')) // => ['test ', ' graph ', 'hello ']
  show(unaligned_modify(g, 5, 6, ' ')) // => ['test ', ' raph ', 'hello ']
  show(unaligned_modify(g, 0, 15, '_')) // => ['_o ']
  show(unaligned_modify(g, 0, 16, '_')) // => ['_ ']
  show(unaligned_modify(g, 0, 17, '_')) // => ['_ ']
  show(unaligned_modify(g, 16, 16, ' !')) // => ['test ', 'graph ', 'hello ', '! ']

Indexes are character offsets (use CodeMirror's doc.posFromIndex and doc.indexFromPos to convert) */
export function unaligned_modify(
  g: Graph,
  from: number,
  to: number,
  text: string,
  side: Side = 'target'
): Graph {
  const tokens = get_side_texts(g, side)
  const {token: from_token, offset: from_ix} = T.token_at(tokens, from)
  const pre = (tokens[from_token] || '').slice(0, from_ix)
  if (to === get_side_text(g, side).length) {
    return unaligned_modify_tokens(g, from_token, g[side].length, pre + text, side)
  } else {
    const {token: to_token, offset: to_ix} = T.token_at(tokens, to)
    const post = (tokens[to_token] || '').slice(to_ix)
    return unaligned_modify_tokens(g, from_token, to_token + 1, pre + text + post, side)
  }
}

/** Replace the text at some position, merging the spans it touches upon.

  const show = (g: Graph) => g.target.map(t => t.text)
  const ids = (g: Graph) => g.target.map(t => t.id).join(' ')
  const g = init('test graph hello')
  show(g) // => ['test ', 'graph ', 'hello ']
  show(unaligned_modify_tokens(g, 0, 0, 'this '))     // => ['this ', 'test ', 'graph ', 'hello ']
  show(unaligned_modify_tokens(g, 0, 1, 'this '))     // => ['this ', 'graph ', 'hello ']
  show(unaligned_modify_tokens(g, 0, 1, '  white '))  // => ['  white ', 'graph ', 'hello ']
  show(unaligned_modify_tokens(g, 0, 1, 'this'))      // => ['thisgraph ', 'hello ']
  show(unaligned_modify_tokens(g, 1, 2, 'graph'))     // => ['test ', 'graphhello ']
  show(unaligned_modify_tokens(g, 1, 2, ' graph '))   // => ['test ', ' graph ', 'hello ']
  show(unaligned_modify_tokens(g, 0, 1, 'for this ')) // => ['for ', 'this ', 'graph ', 'hello ']
  show(unaligned_modify_tokens(g, 0, 2, '')) // => ['hello ']
  show(unaligned_modify_tokens(g, 0, 2, '  ')) // => ['  hello ']
  show(unaligned_modify_tokens(g, 1, 3, '  ')) // => ['test   ']
  show(unaligned_modify_tokens(g, 3, 3, ' !')) // => ['test ', 'graph ', 'hello  ', '! ']
  show(unaligned_modify_tokens(init('a '), 0, 1, ' ')) // => [' ']
  ids(g) // => 't0 t1 t2'
  ids(unaligned_modify_tokens(g, 0, 0, 'this '))     // => 't3 t0 t1 t2'
  ids(unaligned_modify_tokens(g, 0, 1, 'this '))     // => 't3 t1 t2'
  ids(unaligned_modify_tokens(g, 0, 1, 'this'))      // => 't3 t2'
  const showS = (g: Graph) => g.source.map(t => t.text)
  const idsS = (g: Graph) => g.source.map(t => t.id).join(' ')
  showS(unaligned_modify_tokens(g, 0, 0, 'this ', 'source')) // => ['this ', 'test ', 'graph ', 'hello ']
  idsS(unaligned_modify_tokens(g, 0, 0, 'this ', 'source'))  // => 's3 s0 s1 s2'

Indexes are token offsets */
export function unaligned_modify_tokens(
  g: Graph,
  from: number,
  to: number,
  text: string,
  side: Side = 'target'
): Graph {
  if (from < 0 || to < 0 || from > g[side].length || to > g[side].length || from > to) {
    throw new Error('Invalid coordinates ' + Utils.show({g, from, to, text}))
  }
  if (text.match(/^\s+$/)) {
    // replacement text is only whitespace: need to find some token to put it on
    if (from > 0) {
      return unaligned_modify_tokens(g, from - 1, to, g[side][from - 1].text + text, side)
    } else if (to < g[side].length) {
      return unaligned_modify_tokens(g, from, to + 1, text + g[side][to].text, side)
    } else {
      // console.warn('Introducing whitespace into empty graph')
    }
  }
  if (text.match(/\S$/) && to < g[side].length) {
    // if replacement text does not end with whitespace, grab the next word as well
    return unaligned_modify_tokens(g, from, to + 1, text + g[side][to].text, side)
  }

  if (from > 0 && from == g[side].length && to === g[side].length) {
    // we're adding a word at the end but the last token might not end in whitespace:
    // glue them together

    return unaligned_modify_tokens(g, from - 1, to, g[side][from - 1].text + text, side)
  }

  const id_offset = next_id(g)
  const tokens = T.tokenize(text).map((t, i) => Token(t, side[0] + (id_offset + i)))
  const [new_tokens, removed] = Utils.splice(g[side], from, to - from, ...tokens)
  const ids_removed = new Set(removed.map(t => t.id))
  const new_edge_ids = new Set<string>(tokens.map(t => t.id))
  const new_edge_labels = new Set<string>()
  let new_edge_manual = false
  const edges = record.filter(g.edges, e => {
    if (e.ids.some(id => ids_removed.has(id))) {
      e.ids.forEach(id => ids_removed.has(id) || new_edge_ids.add(id))
      e.labels.forEach(lbl => new_edge_labels.add(lbl))
      new_edge_manual = new_edge_manual || e.manual === true
      return false
    } else {
      return true
    }
  })
  if (new_edge_ids.size > 0) {
    const e = Edge([...new_edge_ids], [...new_edge_labels], new_edge_manual)
    edges[e.id] = e
  }
  return {...g, [side]: new_tokens, edges}
}

export function modify(
  g: Graph,
  from: number,
  to: number,
  text: string,
  side: Side = 'target'
): Graph {
  return align(unaligned_modify(g, from, to, text, side))
}

export function modify_tokens(
  g: Graph,
  from: number,
  to: number,
  text: string,
  side: Side = 'target'
): Graph {
  return align(unaligned_modify_tokens(g, from, to, text, side))
}

/** Moves a slice of the target tokens and puts it at a new destination.

  target_text(unaligned_rearrange(init('apa bepa cepa depa'), 1, 2, 0)) // => 'bepa cepa apa depa '

Indexes are token offsets
*/
export function unaligned_rearrange(g: Graph, begin: number, end: number, dest: number): Graph {
  const em = edge_map(g)
  const edge_ids_to_update = new Set(
    g.target.slice(begin, end + 1).map(t => (em.get(t.id) as Edge).id)
  )
  const new_edges = {} as Record<string, Edge>
  edge_ids_to_update.forEach(id => {
    new_edges[id] = merge_edges(g.edges[id], Edge([], [], true))
  })
  return {
    ...g,
    source: g.source,
    target: Utils.rearrange(g.target, begin, end, dest),
    edges: {...g.edges, ...new_edges},
  }
}

export function rearrange(g: Graph, begin: number, end: number, dest: number): Graph {
  return align(unaligned_rearrange(g, begin, end, dest))
}

export function unaligned_set_side(g: Graph, side: Side, text: string): Graph {
  const text0 = get_side_text(g, side)
  const {from, to} = Utils.edit_range(text0, text)
  const new_text = text.slice(from, text.length - (text0.length - to))
  return unaligned_modify(g, from, to, new_text, side)
}

/**

  target_text(set_target(init('apa bepa'), 'aupa bpa ')) // => 'aupa bpa '
  target_text(set_target(init('fz'), 'bar ')) // => 'bar '
  target_text(set_target(init('foo'), 'bar ')) // => 'bar '
  target_text(set_target(init('fooz'), 'bar ')) // => 'bar '
  target_text(set_target(init('a'), 'a ')) // => 'a '
  target_text(set_target(init('a'), '  ')) // => '  '

*/
export function set_target(g: Graph, text: string): Graph {
  return align(unaligned_set_side(g, 'target', text))
}

export function set_source(g: Graph, text: string): Graph {
  return align(unaligned_set_side(g, 'source', text))
}

export function set_side(g: Graph, side: Side, text: string): Graph {
  return sidecase(side, set_source, set_target)(g, text)
}

export function get_side_text(g: Graph, side: Side): string {
  return T.text(g[side])
}

export function get_side_texts(g: Graph, side: Side): string[] {
  return T.texts(g[side])
}

/** Invert the graph: swap source and target, without aligning */
export function unaligned_invert(g: Graph): Graph {
  return {...g, source: g.target, target: g.source}
}

/** Invert the graph: swap source and target.

Note that this is not stable, ie not involutive since texts get automatically
realigned. This can make labels get transferred between groups.
*/
export function invert(g: Graph): Graph {
  return align(unaligned_invert(g))
}

/** Revert at an edge id */
export function unaligned_revert(g: Graph, edge_ids: string[]): Graph {
  const edge_set = new Set(edge_ids)
  const diff = calculate_dnd_diff(g)
  let supply = next_id(g)
  const edges = record.filter(g.edges, (_, id) => !edge_set.has(id))
  const reverted = Utils.flatMap(
    diff,
    D.dnd_match({
      Dragged(d) {
        if (edge_set.has(d.id)) {
          const s = d.source
          const t = {...d.source, id: 't' + supply++}
          const e = Edge([s.id, t.id], [])
          edges[e.id] = e
          return [D.Dragged(s, e.id, false), D.Dropped(t, e.id, false)]
        } else {
          return [d]
        }
      },
      Dropped(d) {
        if (edge_set.has(d.id)) {
          return []
        } else {
          return [d]
        }
      },
    })
  )
  return {...g, ...from_dnd_diff(reverted, edges)}
}

/** Revert at an edge id */
export function revert(g: Graph, edge_ids: string[]): Graph {
  return align(unaligned_revert(g, edge_ids))
}

/** Connect edges by ids */
export function connect(g: Graph, edge_ids: string[]): Graph {
  const edges = record.filter(g.edges, (e, _) => !edge_ids.some(id => id == e.id))
  const es = record.traverse(
    record.filter(g.edges, (e, _) => edge_ids.some(id => id == e.id)),
    e => e
  )
  const edge = merge_edges(...es, Edge([], [], true))
  edges[edge.id] = edge
  return align({...g, edges})
}

/** Disconnect a source or target id */
export function disconnect(g: Graph, ids: string[]): Graph {
  if (ids.length == 0) {
    return align(g)
  }
  const id = ids[0]
  const em = edge_map(g)
  const edge = em.get(id)
  if (edge) {
    const edge_without = Edge(edge.ids.filter(i => i != id), edge.labels, true, edge.comment)
    const edge_with = Edge([id], [], true, edge.comment)
    const edges = record.filter(g.edges, (_, id) => id != edge.id)
    edges[edge_with.id] = edge_with
    if (edge_without.ids.length > 0) {
      edges[edge_without.id] = edge_without
    }
    return disconnect({...g, edges}, ids.slice(1))
  } else {
    Utils.stderr({id, ids, g})
    return Utils.raise('Trying to disconnect unidentifiable token')
  }
}

/** Get the index of the first token of an edge.

  const g = init('apa bepa cepa ')
  const e = g.edges['e-s1-t1']
  edge_first_index(g, e, 'source') // => 1

 */
export function edge_first_index(g: Graph, edge: Edge, side: Side): number | undefined {
  return edge.ids
    .map(id => token_map(g).get(id) as SidedIndex)
    .filter(si => si.side == side)
    .map(si => si.index)
    .shift()
}

/** Group edges into groups of consecutive tokens.

  const g = init('apa bepa cepa depa ')
  const es = [g.edges['e-s0-t0'], g.edges['e-s1-t1'], g.edges['e-s3-t3']]
  group_consecutive(g, es, 'source') // => [[es[0], es[1]], [es[2]]]

 */
export function group_consecutive(g: Graph, edges: Edge[], side: Side) {
  return Utils.group_contiguous(edges, e => {
    let i = edge_first_index(g, e, side)
    return i !== undefined ? i : -1
  })
}

interface CharIdPair {
  char: string
  id?: string
}

/**

  [
    {char: ' ', id: undefined},
    {char: 'a', id: 'id'},
    {char: 'b', id: 'id'},
    {char: ' ', id: undefined}
  ] // => to_char_ids(Token(' ab ', 'id'))

*/
function to_char_ids(token: Token): CharIdPair[] {
  return Utils.str_map(token.text, char => ({char, id: char === ' ' ? undefined : token.id}))
}

/** Create edges automatically between similar sequences of tokens.

  const g0 = {...init('a bc d')}
  const g = unaligned_set_side(g0, 'target', 'ab c d')
  Object.values(align(g).edges).length // => 2
*/
export function align(g: Graph): Graph {
  // Use a union-find to group characters into edges.
  const uf = Utils.PolyUnionFind<string>(u => u)
  const em = Utils.chain(edge_map(g), m => (id: string): Edge =>
    m.get(id) || Utils.raise(`Token id ${id} not in edge map`)
  )

  {
    // Character by character, what was deleted and inserted?
    const chars = mapSides(g, tokens =>
      Utils.flatMap(tokens.filter(token => !em(token.id).manual), to_char_ids)
    )
    const char_diff = Utils.hdiff(chars.source, chars.target, u => u.char, u => u.char)

    // For any unchanged character, unify its source and target tokens.
    // If source is "a bc" and target is "ab c", all characters will be unified to the same group.
    // The union-find operates over token ids, so an edge is represented by a "root" token id.
    char_diff.forEach(c => {
      if (c.change == 0) {
        // these undefined makes the alignment skip spaces.
        // they originate from to_char_ids
        if (c.a.id !== undefined && c.b.id !== undefined) {
          uf.union(c.a.id, c.b.id)
        }
      }
    })
  }

  // Use manual edges as they are.
  const proto_edges = record.filter(g.edges, e => !!e.manual)

  const first = Utils.unique_check<string>()

  mapSides(g, (tokens, side) =>
    tokens.forEach(token => {
      let e_repr = em(token.id)
      // Skip manual edges, they have already been added.
      if (!e_repr.manual) {
        // Use the labels from the old edge.
        const labels = first(e_repr.id) ? e_repr.labels : []
        // New edges are temporarily keyed by the "root" token id.
        // Merge a single-token edge into the edge that has the same "root" token.
        // Or add as a new edge if there is no such edge yet.
        const e_token = Edge([token.id], labels, false, e_repr.comment)
        record.modify(proto_edges, uf.find(token.id), zero_edge, e => merge_edges(e, e_token))
      }
    })
  )

  // Re-key edges.
  const edges = edge_record(record.traverse(proto_edges, e => e))

  return {...g, edges}
}

interface ScoreDiffPair {
  score: number
  // A reversed list of the way back (Instead of constructing it from back links)
  diff: Utils.LazySnocList<D.Diff>
}

/** Calculate the (graphView) diff

What we do here is try to find a diff using dragged and dropped looking only
at the edge ids. This is different from finding a normal diff edit script
over an alphabet because the edge ids may be used at several discontinuous
locations that all should be close to each other. This was done using
the diff algorithm before but the results were subpar, see #32


  const expect: D.Diff[] = [
    {
      edit: 'Dragged',
      source: {text: 'apa ', id: 's0'},
      id: "e-s0-t0",
      manual: true
    },
    {
      edit: 'Edited',
      source: [{text: 'bepa ', id: 's1'}],
      target: [{text: 'bepa ', id: 't1'}],
      id: "e-s1-t1",
      manual: true
    },
    {
      edit: 'Edited',
      source: [{text: 'cepa ', id: 's2'}],
      target: [{text: 'cepa ', id: 't2'}],
      id: "e-s2-t2",
      manual: true
    },
    {
      edit: 'Dropped',
      target: {text: 'apa ', id: 't0'},
      id: "e-s0-t0",
      manual: true
    }
  ]
  const g = calculate_diff(rearrange(init('apa bepa cepa ', true), 1, 2, 0))
  g // => expect

  const expect: D.Diff[] = [
    {
      edit: 'Edited',
      source: [{text: 'apa ', id: 's0'}],
      target: [{text: 'apa ', id: 't0'}],
      id: "e-s0-t0",
      manual: true
    }
    {
      edit: 'Edited',
      source: [{text: 'bepa ', id: 's1'}],
      target: [
        {text: 'depa ', id: 't3'},
        {text: 'epa ', id: 't4'}
      ],
      id: "e-s1-t3-t4",
      manual: true
    },
    {
      edit: 'Edited',
      source: [{text: 'cepa ', id: 's2'}],
      target: [{text: 'cepa ', id: 't2'}],
      id: "e-s2-t2",
      manual: true
    }
  ]
  const g = calculate_diff(modify_tokens(init('apa bepa cepa ', true), 1, 2, 'depa epa '))
  g // => expect

*/
export function calculate_diff(
  g: Graph,
  order_changing_label: (s: string) => boolean = () => false
): D.Diff[] {
  const m = edge_map(g)
  const lookup = (tok: Token) => m.get(tok.id) as Edge

  const I = g.source.length
  const J = g.target.length

  const OPT: ScoreDiffPair[][] = new Array(I + 1)
    .fill({})
    .map(i => new Array(J + 1).fill({score: 0, diff: null}))

  function opt(i: number, j: number) {
    if (i < 0 && j < 0) {
      return {score: 0, diff: null}
    } else {
      return OPT[i + 1][j + 1]
    }
  }

  for (let i = -1; i < I; ++i) {
    for (let j = -1; j < J; ++j) {
      const cands: ScoreDiffPair[] = []
      const same = (ii: number, jj: number) =>
        ii >= 0 && jj >= 0 && lookup(g.source[ii]).id === lookup(g.target[jj]).id
      if (i >= 0 && j >= 0 && same(i, j)) {
        let ii = i
        let jj = j
        while (same(--ii, j));
        while (same(i, --jj));
        const edge = lookup(g.source[i])
        const {score, diff} = opt(ii, jj)
        let factor = 1
        if (edge.manual) {
          factor *= 0.01
        }
        if (edge.labels.some(order_changing_label)) {
          factor *= 0.0001
        }
        cands.push({
          score: score + factor * (i - ii + (j - jj)),
          diff: Utils.snoc(
            diff,
            D.Edited(
              g.source.slice(ii + 1, i + 1),
              g.target.slice(jj + 1, j + 1),
              edge.id,
              !!edge.manual
            )
          ),
        })
      }
      if (j >= 0) {
        const {score, diff} = opt(i, j - 1)
        const edge = lookup(g.target[j])
        cands.push({score, diff: Utils.snoc(diff, D.Dropped(g.target[j], edge.id, !!edge.manual))})
      }
      if (i >= 0) {
        const {score, diff} = opt(i - 1, j)
        const edge = lookup(g.source[i])
        cands.push({score, diff: Utils.snoc(diff, D.Dragged(g.source[i], edge.id, !!edge.manual))})
      }
      OPT[i + 1][j + 1] = R.sortBy(x => -x.score, cands)[0]
    }
  }

  const {score, diff} = opt(I - 1, J - 1)
  const arr = Utils.snocsToArray(diff)
  return arr
}

/**

  const diff: D.Diff[] = [
    {
      edit: 'Edited',
      source: [{text: 'a ', id: 's0'}],
      target: [{text: 'b ', id: 't0'}],
      id: 'e0',
      manual: true
    },
    {
      edit: 'Edited',
      source: [{text: 'c ', id: 's1'}],
      target: [
        {text: 'd ', id: 't3'},
        {text: 'e ', id: 't4'}
      ],
      id: 'e1',
      manual: true
    }
  ]
  const expected: D.Diff[] = [
    {edit: 'Dragged', source: {text: 'a ', id: 's0'}, id: 'e0', manual: true},
    {edit: 'Dropped', target: {text: 'b ', id: 't0'}, id: 'e0', manual: true},
    {edit: 'Dragged', source: {text: 'c ', id: 's1'}, id: 'e1', manual: true},
    {edit: 'Dropped', target: {text: 'd ', id: 't3'}, id: 'e1', manual: true},
    {edit: 'Dropped', target: {text: 'e ', id: 't4'}, id: 'e1', manual: true}
  ]
  split_up_edits(diff) // => expected
  split_up_edits(diff, id => id == 'e0') // => [...expected.slice(0,2), diff[1]]
  split_up_edits(diff, id => id == 'e1') // => [diff[0], ...expected.slice(2)]
  split_up_edits(diff, _ => false) // => diff

*/
export function split_up_edits(ds: D.Diff[], audit = (edge_id: string) => true): D.Diff[] {
  return Utils.flatMap<D.Diff, D.Diff>(ds, d => {
    if (d.edit == 'Edited' && audit(d.id)) {
      return [
        ...d.source.map(t => D.Dragged(t, d.id, d.manual)),
        ...d.target.map(t => D.Dropped(t, d.id, d.manual)),
      ]
    } else {
      return [d]
    }
  })
}

export function calculate_dnd_diff(
  g: Graph,
  order_changing_label: (s: string) => boolean = () => false
): (D.Dragged | D.Dropped)[] {
  return split_up_edits(calculate_diff(g, order_changing_label)) as any
}

export function from_dnd_diff(
  diff: (D.Dragged | D.Dropped)[],
  edges0: Record<string, Edge>
): Graph {
  const source = [] as Token[]
  const target = [] as Token[]
  const edges = R.clone(edges0)
  diff.forEach(d =>
    record.modify(edges, d.id, zero_edge, e => merge_edges(e, Edge([], [], d.manual)))
  )
  diff.forEach(
    D.dnd_match({
      Dragged: d => source.push(d.source),
      Dropped: d => target.push(d.target),
    })
  )
  return {source, target, edges}
}

/**

  const g = modify_tokens(init('apa bepa cepa '), 1, 2, 'depa epa ')
  const diff = calculate_diff(g)
  const g2 = diff_to_graph(diff, g.edges)
  g2 // => g

*/
export function diff_to_graph(diff: D.Diff[], edges: Record<string, Edge>): Graph {
  return align(from_dnd_diff(split_up_edits(diff) as any, edges))
}

/** Gets the sentence in the target text around some offset, without thinking about edits */
export function target_sentence(g: Graph, i: number): Span {
  return T.sentence(target_texts(g), i)
}

export type Subspan = {source: Span; target: Span}

export function subspan_merge(ss: Subspan[]) {
  let {source, target} = ss[0]
  ss.forEach(s => {
    source = T.span_merge(source, s.source)
    target = T.span_merge(target, s.target)
  })
  return {source, target}
}

export function subspan_to_indicies(subspan: Subspan): SidedIndex[] {
  const span_to_indicies = (side: Side) => [
    {side, index: subspan[side].begin},
    {side, index: subspan[side].end},
  ]
  return [...span_to_indicies('source'), ...span_to_indicies('target')]
}

/** Gets the sentence in the target text around some offset(s)

  const g = init('apa bepa . Cepa depa . epa ', true)
  sentences(g, 0) // => {source: {begin: 0, end: 2}, target: {begin: 0, end: 2}}
  sentences(g, 1) // => {source: {begin: 0, end: 2}, target: {begin: 0, end: 2}}
  sentences(g, 2) // => {source: {begin: 0, end: 2}, target: {begin: 0, end: 2}}
  sentences(g, 3) // => {source: {begin: 3, end: 5}, target: {begin: 3, end: 5}}
  const g2 = modify_tokens(g, 1, 4, 'uff ! Hepp plepp ')
  target_text(g2) // => 'apa uff ! Hepp plepp depa . epa '
  sentences(g2, 0) // => {source: {begin: 0, end: 5}, target: {begin: 0, end: 6}}
  sentences(g2, 1) // => {source: {begin: 0, end: 5}, target: {begin: 0, end: 6}}
  sentences(g2, 2) // => {source: {begin: 0, end: 5}, target: {begin: 0, end: 6}}
  sentences(g2, 3) // => {source: {begin: 0, end: 5}, target: {begin: 0, end: 6}}
  const g3 = modify_tokens(g, 6, 7, '')
  target_text(g3) // => 'apa bepa . Cepa depa . '
  sentences(g3, 4) // => {source: {begin: 3, end: 6}, target: {begin: 3, end: 5}}
  sentences(g3, 5) // => {source: {begin: 3, end: 6}, target: {begin: 3, end: 5}}

*/
export function sentences(g: Graph, target_index: number): Subspan {
  return sentences_around(g, [{side: 'target', index: target_index}])
}

/** Gets the sentences around some indicies */
export function sentences_around(g: Graph, indicies: SidedIndex[]): Subspan {
  const starts = Utils.PolyUnionFind<SidedIndex>()
  const bounds = mapSides(g, (tokens, side) => {
    const bs = T.sentence_starts(T.texts(tokens))
    bs.forEach((start, index) => {
      starts.union({side, index}, {side, index: start})
    })
    return bs
  })
  const m = token_map(g)
  record.forEach(g.edges, e => {
    const ids = e.ids.map(id => m.get(id) as SidedIndex)
    starts.unions(ids)
  })
  starts.unions(indicies)

  const main = indicies[0]

  // grr-ish: we want to get the "minimal" representative now, but have to loop over
  // all positions to check.
  const em = edge_map(g)
  const main_repr = starts.repr(main)
  return mapSides(g, (tokens, side) => {
    // If sentence starts or ends with only removed tokens we slurp these straggler tokens:
    function pad_missing(d: number, index: number): number {
      if (index < 0) {
        return 0
      }
      if (index >= tokens.length) {
        return tokens.length - 1
      }
      const adjacent = tokens[index + d]
      if (!adjacent) {
        return index
      }
      const edge = em.get(adjacent.id)
      if (!edge) {
        return index
      }
      const all_on_this_side = edge.ids.every(id => {
        const token = m.get(id)
        return token ? token.side == side : false
      })
      if (!all_on_this_side) {
        return index
      }
      return pad_missing(d, index + d)
    }
    return {
      begin: pad_missing(
        -1,
        tokens.findIndex((_, index) => starts.repr({side, index}) == main_repr)
      ),
      end: pad_missing(
        1,
        Utils.findLastIndex(tokens, (_, index) => starts.repr({side, index}) == main_repr)
      ),
    }
  })
}

/** All sentences in a text starting from an offset in the target text. */
export function all_sentences(g: Graph, begin: number = 0): Subspan[] {
  if (begin >= g.target.length) {
    return []
  } else {
    const s = sentences(g, begin)
    return [s].concat(all_sentences(g, s.target.end + 1))
  }
}

/** The subgraph from a subspan

  const g = init('apa bepa . cepa depa . epa')
  target_text(subgraph(g, sentences(g, 3))) // => 'cepa depa . '

*/
export function subgraph(g: Graph, s: Subspan): Graph {
  const source = g.source.slice(s.source.begin, s.source.end + 1)
  const target = g.target.slice(s.target.begin, s.target.end + 1)
  const proto_g = {source, target, edges: edge_record([])}
  const sm = source_map(proto_g)
  const tm = target_map(proto_g)
  const edges = record.filter(g.edges, e => e.ids.some(id => sm.has(id) || tm.has(id)))
  return {source, target, edges}
}

export function indicies_around_positions(
  g: Graph,
  side: Side,
  positions: number[]
): {side: Side; index: number}[] {
  const N = target_text(g).length
  const nearby = Utils.flatMap(positions, i => [i - 1, i, i + 1])
  const in_bounds = nearby.filter(i => Utils.within(0, i, N))
  return in_bounds.map(i => ({
    side: side,
    index: T.token_at(get_side_texts(g, side), i).token,
  }))
}

/** Given many graphs on the same source text, find the overlapping sentence groups

Uses merge_series which is very inefficient
*/
export function sentence_groups<K extends string>(gs: Record<K, Graph>): Record<K, Subspan>[] {
  return Utils.merge_series(
    record.map(gs, g => all_sentences(g)),
    subspan_merge,
    R.eqProps('source')
  )
}

/** Get a set of used labels.

  const g = {
    source: [{id: 's0', text: 'x '}, {id: 's1', text: 'y '}],
    target: [{id: 't0', text: 'x '}, {id: 't1', text: 'y '}],
    edges: {
      'e-s0-t0': {id: 'e-s0-t0', ids: ['s0', 't0'], labels: ['A', 'B'], manual: false},
      'e-s1-t1': {id: 'e-s1-t1', ids: ['s1', 't1'], labels: ['A'], manual: false},
    }
  }
  used_labels(g).sort() // => ['A', 'B']

*/
export function used_labels(g: Graph): string[] {
  return Utils.uniq(Utils.flatMap(Object.values(g.edges), e => e.labels))
}

/** Whether a label permits a comment.

  is_comment_label('pl') // => false
  is_comment_label('!') // => true
 */
export function is_comment_label(label: string): boolean {
  return label.indexOf('!') != -1
}

/** Modify the labels at an identifier

  const g = init('word')
  const g2 = modify_labels(g, 'e-s0-t0', (labels: string[]) => [...labels, 'ABC'])
  const g3 = modify_labels(g2, 'e-s0-t0', (labels: string[]) => [...labels, 'DEF'])
  g3.edges['e-s0-t0'].labels // => ['ABC', 'DEF']

*/
export function modify_labels(g: Graph, edge_id: string, k: (labels: string[]) => string[]): Graph {
  const store = Store.init(g)
  const edge = edge_store(store, edge_id)
  edge.modify(e => {
    const labels = k(e.labels)
    const comment = labels.some(is_comment_label) ? e.comment : undefined
    return Edge(e.ids, labels, e.manual, comment)
  })
  return store.get()
}

export function comment_edge(g: Graph, edge_id: string, comment?: string) {
  const store = Store.init(g)
  const edge = edge_store(store, edge_id)
  edge.modify(e => Edge(e.ids, e.labels, e.manual, comment))
  return store.get()
}

export function edge_store(g: Store<Graph>, edge_id: string): Store<Edge> {
  return g
    .at('edges')
    .via(Lens.key(edge_id))
    .via(Lens.def(Edge([], [])))
}

/** Normalize the unique identifiers in this graph. Use before comparing deep equality.

  const g = modify_tokens(init('apa bepa cepa '), 1, 2, 'depa epa ')
  normalize(normalize(g)) // => normalize(g)

  // new graphs are in normal form, except that they are not marked as manual
  const g = init('apa bepa cepa ')
  normalize(g, 'keep') // => g

  const g = init('x')
  const ab = {
    source: [{id: 'a0', text: 'x '}],
    target: [{id: 'b0', text: 'x '}],
    edges: {'e-a0-b0': {id: 'e-a0-b0', ids: ['a0', 'b0'], labels: [], manual: false}}
  }
  normalize(g, 'keep', 'a', 'b') // => ab

  const g = init('x')
  const same = {
    source: [{id: '0', text: 'x '}],
    target: [{id: '1', text: 'x '}],
    edges: {'e-0-1': {id: 'e-0-1', ids: ['0', '1'], labels: [], manual: false}}
  }
  normalize(g, 'keep', '', '') // => same

*/
export function normalize(
  g: Graph,
  set_manual_to: boolean | 'keep' = true,
  s_prefix = 's',
  t_prefix = 't'
): Graph {
  const rev = {} as Record<string, string>
  const rn = Utils.Renumber<string>()
  g.source.forEach(tk => rn.num(tk.id))
  g.target.forEach(tk => rn.num(tk.id))
  const N = g.source.length
  const new_id = (id: string) => {
    const i = rn.num(id)
    return i < N || s_prefix == t_prefix ? s_prefix + i : t_prefix + (i - N)
  }
  const source = g.source.map(s => Token(s.text, new_id(s.id)))
  const target = g.target.map(s => Token(s.text, new_id(s.id)))
  const edges = R.fromPairs(
    record.traverse(g.edges, e => {
      const E = Edge(
        e.ids.map(new_id),
        e.labels.sort(),
        set_manual_to === 'keep' ? e.manual : set_manual_to,
        e.comment
      )
      return [E.id, E] as [string, Edge]
    })
  )
  return {source, target, edges, ...(g.comment ? {comment: g.comment} : {})}
}

export function equal(g1: Graph, g2: Graph, set_manual_to: boolean | 'keep' = true): boolean {
  return R.equals(normalize(g1, set_manual_to), normalize(g2, set_manual_to))
}

/** Make all trailing whitespace of a specific form */
export function normalize_whitespace(g: Graph, ws = ' '): Graph {
  const on_tok = (s: Token) => Token((s.text.match(/\S+/) || [''])[0] + ws, s.id)
  return {...g, source: g.source.map(on_tok), target: g.target.map(on_tok)}
}

/** Sets the target text to the source text, but preserving all labels and comments */
export function source_to_target(g: Graph, make_manual: boolean = true): Graph {
  let i = next_id(g)
  const rename_map: Record<string, string> = {}
  const target = g.source.map(s => {
    const id = 't' + i++
    rename_map[s.id] = id
    return Token(s.text, id)
  })
  const edges = Utils.flatMap(Object.values(g.edges), e => {
    const ids = Utils.flatMap(e.ids, sid => {
      const tid = rename_map[sid]
      if (tid) {
        return [sid, tid]
      } else {
        return []
      }
    })
    if (ids.length > 0) {
      return [Edge(ids, e.labels, make_manual, e.comment)]
    } else {
      return []
    }
  })
  return {source: g.source, target, edges: edge_record(edges)}
}

/* Sort edge labels according to some order */
export function sort_edge_labels(g: Graph, order: (label: string) => number): Graph {
  return {
    ...g,
    edges: record.map(g.edges, e => Edge(e.ids, R.sortBy(order, e.labels), e.manual, e.comment)),
  }
}

/** Map from labels to edges where they are used.

  const g = modify_labels(init('apa bepa'), 'e-s1-t1', () => ['L', 'LL'])
  label_edge_map(g, l => l.length > 1) // => {'LL': [g.edges['e-s1-t1']]}
  label_edge_map(g) // => {'L': [g.edges['e-s1-t1']], 'LL': [g.edges['e-s1-t1']]}
 */
export function label_edge_map(g: Graph, filter?: (l: string) => boolean): Record<string, Edge[]> {
  const label_edge_map: Record<string, Edge[]> = {}
  record.forEach(g.edges, e =>
    e.labels.forEach(l => (!filter || filter(l)) && Utils.push(label_edge_map, l, e))
  )
  return label_edge_map
}
