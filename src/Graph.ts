/** Parallel corpus as a graph

Idea: make a variant type describing different kinds of positions:

  - for source and target:
    - from start of text and from start of current sentence:
      - character offset
      - token index
      - token identifier
  - edge identifier

Make the exposed functions coordinates take any of these and convert them to the internal
function's preferred view before executing

*/
import * as R from 'ramda'
import * as Utils from './Utils'
import * as record from './record'
import {Diff, Dragged, Dropped} from './Diff'
import * as D from './Diff'
import {Token, Span} from './Token'
import * as T from './Token'
import {Lens, Store} from 'reactive-lens'

export function with_st<A, B>(g: ST<A>, f: (a: A, side: 'source' | 'target') => B): ST<B> {
  return {source: f(g.source, 'source'), target: f(g.target, 'target')}
}

export interface ST<A> {
  readonly source: A
  readonly target: A
}

export interface Graph extends ST<Token[]> {
  edges: Edges
}

export type Edges = Record<string, Edge>

export interface Edge {
  readonly id: string
  readonly ids: string[]
  readonly labels: string[]
  readonly manual?: boolean
}

export function Edge(ids: string[], labels: string[], manual = false): Edge {
  const ids_sorted = ids.sort()
  const labels_nub = Utils.uniq(labels)
  return {id: 'e-' + ids_sorted.join('-'), ids: ids_sorted, labels: labels_nub, manual}
}

export function merge_edges(...es: Edge[]) {
  return Edge(
    Utils.flatMap(es, e => e.ids),
    Utils.flatMap(es, e => e.labels),
    es.some(e => !!e.manual)
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
  'violation' in check_invariant(g) // => true

It's ok for edges to be connected with only tokens from one side,
but should it be?

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
  } catch (e) {
    // console.error(e)
    // console.error(JSON.stringify(g, undefined, 2))
    return {violation: e.toString(), g}
  }
  R.equals(g, align(g)) || Utils.raise('Graph not automatically aligned')
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
  return {
    source: T.identify(tokens, 's'),
    target: T.identify(tokens, 't'),
    edges: edge_record(tokens.map((_, i) => Edge(['s' + i, 't' + i], [], manual))),
  }
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

/**

  const g = init('a b c')
  const e = Edge(['s1', 't1'], [])
  const source = [g.source[1]]
  const target = [g.target[1]]
  partition_ids(g)(e) // => {source, target}

*/
export function partition_ids(g: Graph): (edge: Edge) => {source: Token[]; target: Token[]} {
  const sm = source_map(g)
  const tm = target_map(g)
  return (edge: Edge) => {
    const source = [] as Token[]
    const target = [] as Token[]
    edge.ids.forEach(id => {
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

/** Map from source identifiers to offsets

  const g = init('a b c')
  const m = source_map(g)
  m.get('s0') // => 0
  m.get('s1') // => 1
  m.has('t0') // => false

*/
export function source_map(g: Graph): Map<string, number> {
  return new Map(g.source.map((s, i) => [s.id, i] as [string, number]))
}

/** Map from target identifiers to offsets

  const g = init('a b c')
  const m = target_map(g)
  m.get('t0') // => 0
  m.get('t1') // => 1
  m.has('s0') // => false

*/
export function target_map(g: Graph): Map<string, number> {
  return new Map(g.target.map((t, i) => [t.id, i] as [string, number]))
}

/** The edge at a position (in the target text)

  const g = init('apa bepa cepa')
  edge_at(g, 1) // => Edge(['s1', 't1'], [])

*/
export function edge_at(g: Graph, index: number): Edge {
  const target_id = g.target[index].id
  return edge_map(g).get(target_id) || Utils.raise('Out of bounds: ' + JSON.stringify({g, index}))
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
export function target_text(g: Graph): string {
  return T.text(g.target)
}

/** The text in the source

  source_text(init('apa bepa cepa ')) // => 'apa bepa cepa '

*/
export function source_text(g: Graph): string {
  return T.text(g.source)
}

/** The texts in the target

  target_texts(init('apa bepa cepa ')) // => ['apa ', 'bepa ', 'cepa ']

*/
export function target_texts(g: Graph): string[] {
  return T.texts(g.target)
}

/** The texts in the source

  source_texts(init('apa bepa cepa ')) // => ['apa ', 'bepa ', 'cepa ']

*/
export function source_texts(g: Graph): string[] {
  return T.texts(g.source)
}

/** Replace the text at some position, merging the spans it touches upon.

  const show = (g: Graph) => g.target.map(t => t.text)
  const ids = (g: Graph) => g.target.map(t => t.id).join(' ')
  const g = init('test graph hello')
  show(g) // => ['test ', 'graph ', 'hello ']
  show(proto_modify(g, 0, 0, 'new')) // => ['newtest ', 'graph ', 'hello ']
  show(proto_modify(g, 0, 1, 'new')) // => ['newest ', 'graph ', 'hello ']
  show(proto_modify(g, 0, 5, 'new ')) // => ['new ', 'graph ', 'hello ']
  show(proto_modify(g, 0, 5, 'new')) // => ['newgraph ', 'hello ']
  show(proto_modify(g, 5, 5, ' ')) // => ['test ', ' graph ', 'hello ']
  show(proto_modify(g, 5, 6, ' ')) // => ['test ', ' raph ', 'hello ']
  show(proto_modify(g, 0, 15, '_')) // => ['_o ']
  show(proto_modify(g, 0, 16, '_')) // => ['_ ']
  show(proto_modify(g, 0, 17, '_')) // => ['_ ']
  show(proto_modify(g, 16, 16, ' !')) // => ['test ', 'graph ', 'hello ', '! ']

Indexes are character offsets (use CodeMirror's doc.posFromIndex and doc.indexFromPos to convert) */
export function proto_modify(g: Graph, from: number, to: number, text: string): Graph {
  const tokens = target_texts(g)
  const {token: from_token, offset: from_ix} = T.token_at(tokens, from)
  const pre = (tokens[from_token] || '').slice(0, from_ix)
  if (to === target_text(g).length) {
    return proto_modify_tokens(g, from_token, g.target.length, pre + text)
  } else {
    const {token: to_token, offset: to_ix} = T.token_at(tokens, to)
    const post = (tokens[to_token] || '').slice(to_ix)
    return proto_modify_tokens(g, from_token, to_token + 1, pre + text + post)
  }
}

/** Replace the text at some position, merging the spans it touches upon.

  const show = (g: Graph) => g.target.map(t => t.text)
  const ids = (g: Graph) => g.target.map(t => t.id).join(' ')
  const g = init('test graph hello')
  show(g) // => ['test ', 'graph ', 'hello ']
  show(proto_modify_tokens(g, 0, 0, 'this '))     // => ['this ', 'test ', 'graph ', 'hello ']
  show(proto_modify_tokens(g, 0, 1, 'this '))     // => ['this ', 'graph ', 'hello ']
  show(proto_modify_tokens(g, 0, 1, '  white '))  // => ['  white ', 'graph ', 'hello ']
  show(proto_modify_tokens(g, 0, 1, 'this'))      // => ['thisgraph ', 'hello ']
  show(proto_modify_tokens(g, 1, 2, 'graph'))     // => ['test ', 'graphhello ']
  show(proto_modify_tokens(g, 1, 2, ' graph '))   // => ['test ', ' graph ', 'hello ']
  show(proto_modify_tokens(g, 0, 1, 'for this ')) // => ['for ', 'this ', 'graph ', 'hello ']
  show(proto_modify_tokens(g, 0, 2, '')) // => ['hello ']
  show(proto_modify_tokens(g, 0, 2, '  ')) // => ['  hello ']
  show(proto_modify_tokens(g, 1, 3, '  ')) // => ['test   ']
  show(proto_modify_tokens(g, 3, 3, ' !')) // => ['test ', 'graph ', 'hello  ', '! ']
  show(proto_modify_tokens(init('a '), 0, 1, ' ')) // => [' ']
  ids(g) // => 't0 t1 t2'
  ids(proto_modify_tokens(g, 0, 0, 'this '))     // => 't3 t0 t1 t2'
  ids(proto_modify_tokens(g, 0, 1, 'this '))     // => 't3 t1 t2'
  ids(proto_modify_tokens(g, 0, 1, 'this'))      // => 't3 t2'

Indexes are token offsets */
export function proto_modify_tokens(g: Graph, from: number, to: number, text: string): Graph {
  if (from < 0 || to < 0 || from > g.target.length || to > g.target.length || from > to) {
    throw new Error('Invalid coordinates ' + Utils.show({g, from, to, text}))
  }
  if (text.match(/^\s+$/)) {
    // replacement text is only whitespace: need to find some token to put it on
    if (from > 0) {
      return proto_modify_tokens(g, from - 1, to, g.target[from - 1].text + text)
    } else if (to < g.target.length) {
      return proto_modify_tokens(g, from, to + 1, text + g.target[to].text)
    } else {
      // console.warn('Introducing whitespace into empty graph')
    }
  }
  if (text.match(/\S$/) && to < g.target.length) {
    // if replacement text does not end with whitespace, grab the next word as well
    return proto_modify_tokens(g, from, to + 1, text + g.target[to].text)
  }

  if (from > 0 && from == g.target.length && to === g.target.length) {
    // we're adding a word at the end but the last token might not end in whitespace:
    // glue them together

    return proto_modify_tokens(g, from - 1, to, g.target[from - 1].text + text)
  }

  const id_offset = next_id(g)
  const tokens = T.tokenize(text).map((t, i) => Token(t, 't' + (id_offset + i)))
  const [target, removed] = Utils.splice(g.target, from, to - from, ...tokens)
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
  return {source: g.source, target, edges}
}

export function next_id(g: Graph): number {
  return Utils.next_id([...g.target.map(t => t.id), ...g.source.map(t => t.id)])
}

/** Moves a slice of the target tokens and puts it at a new destination.

  target_text(proto_rearrange(init('apa bepa cepa depa'), 1, 2, 0)) // => 'bepa cepa apa depa '

Indexes are token offsets
*/
export function proto_rearrange(g: Graph, begin: number, end: number, dest: number): Graph {
  return {...g, target: Utils.rearrange(g.target, begin, end, dest)}
}

export function modify(g: Graph, from: number, to: number, text: string): Graph {
  return align(proto_modify(g, from, to, text))
}

export function modify_tokens(g: Graph, from: number, to: number, text: string): Graph {
  return align(proto_modify_tokens(g, from, to, text))
}

export function rearrange(g: Graph, begin: number, end: number, dest: number): Graph {
  return align(proto_rearrange(g, begin, end, dest))
}

/**

  T.text(set_target(init('apa bepa'), 'aupa bpa ').target) // => 'aupa bpa '
  T.text(set_target(init('fz'), 'bar ').target) // => 'bar '
  T.text(set_target(init('foo'), 'bar ').target) // => 'bar '
  T.text(set_target(init('fooz'), 'bar ').target) // => 'bar '
  T.text(set_target(init('a'), 'a ').target) // => 'a '
  T.text(set_target(init('a'), '  ').target) // => '  '

*/
export function set_target(g: Graph, text: string): Graph {
  const patches = Utils.token_diff(T.text(g.target), text)
  const pre = R.takeWhile<[number, string]>(i => i[0] == 0, patches)
  const post = R.takeLastWhile<[number, string]>(i => i[0] == 0, R.drop(pre.length, patches))
  const from = pre.map(i => i[1]).join('').length
  const postlen = post.map(i => i[1]).join('').length
  const to = T.text(g.target).length - postlen
  const new_text = text.slice(from, text.length - postlen)
  const g2 = modify(g, from, to, new_text)
  return g2
}

interface CharId {
  char: string
  id?: string
}

/**

  [
    {char: ' ', id: undefined},
    {char: 'a', id: 'id'},
    {char: 'b', id: 'id'},
    {char: ' ', id: undefined}
  ] // => punctuate(Token(' ab ', 'id'))

*/
function punctuate(token: Token): CharId[] {
  return Utils.str_map(token.text, char => ({char, id: char === ' ' ? undefined : token.id}))
}

export function align(g: Graph): Graph {
  const uf = Utils.PolyUnionFind<string>(u => u)
  const em = Utils.chain(edge_map(g), m => (id: string): Edge =>
    m.get(id) || Utils.raise(`Token id ${id} not in edge map`)
  )

  {
    const chars = with_st(g, tokens =>
      Utils.flatMap(tokens.filter(token => !em(token.id).manual), punctuate)
    )

    const char_diff = Utils.hdiff(chars.source, chars.target, u => u.char, u => u.char)

    char_diff.forEach(c => {
      if (c.change == 0) {
        if (c.a.id !== undefined && c.b.id !== undefined) {
          uf.union(c.a.id, c.b.id)
        }
      }
    })
  }

  const proto_edges = record.filter(g.edges, e => !!e.manual)

  const first = Utils.unique_check<string>()

  with_st(g, (tokens, side) =>
    tokens.forEach(token => {
      let e_repr = em(token.id)
      if (!e_repr.manual) {
        const labels = first(e_repr.id) ? e_repr.labels : []
        const e_token = Edge([token.id], labels, false)
        record.modify(proto_edges, uf.find(token.id), zero_edge, e => merge_edges(e, e_token))
      }
    })
  )

  const edges = edge_record(record.traverse(proto_edges, e => e))

  return {...g, edges}
}

interface ScoreDDL {
  score: number
  diff: DDL
}

type DDL = Utils.SnocList<Dragged | Dropped>

/** Calculate the ladder diff without merging contiguous edits

What we do here is try to find a diff using dragged and dropped looking only
at the edge ids. This is different from finding a normal diff edit script
over an alphabet because the edge ids may be used at several discontinuous
locations that all should be close to each other. This was done using
the diff algorithm before but the results were subpar, see #32

*/
export function calculate_raw_diff(g: Graph): (Dragged | Dropped)[] {
  const m = edge_map(g)
  const lookup = (tok: Token) => m.get(tok.id) as Edge

  const align = Utils.memo2<number, number, ScoreDDL>((i, j) => {
    if (i < 0 && j < 0) {
      return {score: 0, diff: null}
    }
    const cands: ScoreDDL[] = []
    const same = (ii: number, jj: number) =>
      ii >= 0 && jj >= 0 && lookup(g.source[ii]).id === lookup(g.target[jj]).id
    if (i >= 0 && j >= 0 && same(i, j)) {
      let ii = i
      let jj = j
      while (same(--ii, j));
      while (same(i, --jj));
      const edge = lookup(g.source[i])
      const {score, diff} = align(ii, jj)
      cands.push({
        score: score + (i - ii) + (j - jj),
        diff:
          // snoc(diff, D.Edited(g.source.slice(ii,i),g.target.slice(jj,j), edge_id(g.source[i])))
          Utils.snocs(diff, [
            ...g.source
              .slice(ii + 1, i + 1)
              .map(tok => D.Dragged(tok, edge.id, !!edge.manual) as Dragged | Dropped),
            ...g.target
              .slice(jj + 1, j + 1)
              .map(tok => D.Dropped(tok, edge.id, !!edge.manual) as Dragged | Dropped),
          ]),
      })
    }
    if (j >= 0) {
      const {score, diff} = align(i, j - 1)
      const edge = lookup(g.target[j])
      cands.push({score, diff: Utils.snoc(diff, D.Dropped(g.target[j], edge.id, !!edge.manual))})
    }
    if (i >= 0) {
      const {score, diff} = align(i - 1, j)
      const edge = lookup(g.source[i])
      cands.push({score, diff: Utils.snoc(diff, D.Dragged(g.source[i], edge.id, !!edge.manual))})
    }
    return R.sortBy(x => -x.score, cands)[0]
  })

  const {score, diff} = align(g.source.length - 1, g.target.length - 1)
  return Utils.snocsToArray(diff)
}

export function from_raw_diff(diff: (Dragged | Dropped)[], edges0: Record<string, Edge>): Graph {
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

/** Merging contiguous edits */
function merge_diff(diff: (Dragged | Dropped)[]): Diff[] {
  const rev = new Map<string, number[]>()
  diff.forEach((d, i) => {
    let m = rev.get(d.id)
    if (m === undefined) {
      m = []
      rev.set(d.id, m)
    }
    m.push(i)
  })
  const out = [] as Diff[]
  for (let i = 0; i < diff.length; i++) {
    const d = diff[i]
    const m = rev.get(d.id)
    if (m && Utils.contiguous(m)) {
      const {dragged, dropped} = D.partition(diff.slice(i, i + m.length))
      out.push(
        D.Edited(
          dragged.map(c => c.source),
          dropped.map(c => c.target),
          d.id,
          [...dragged, ...dropped].some(d => d.manual)
        )
      )
      i += m.length - 1
    } else {
      out.push(d)
    }
  }
  return out
}

/** Calculate the diff

  const expect: Diff[] = [
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

  const expect: Diff[] = [
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
export function calculate_diff(g: Graph): Diff[] {
  return merge_diff(calculate_raw_diff(g))
}

/**

  const diff: Diff[] = [
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
  const expected: Diff[] = [
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
export function split_up_edits(ds: Diff[], audit = (edge_id: string) => true): Diff[] {
  return Utils.flatMap<Diff, Diff>(ds, d => {
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

/**

  const g = modify_tokens(init('apa bepa cepa '), 1, 2, 'depa epa ')
  const diff = calculate_diff(g)
  const g2 = diff_to_graph(diff, g.edges)
  g2 // => g

*/
export function diff_to_graph(diff: Diff[], edges: Record<string, Edge>): Graph {
  return align(from_raw_diff(split_up_edits(diff) as any, edges))
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

/** Gets the sentence in the target text around some offset

  const g = init('apa bepa . Cepa depa . epa ', true)
  sentence(g, 0) // => {source: {begin: 0, end: 2}, target: {begin: 0, end: 2}}
  sentence(g, 1) // => {source: {begin: 0, end: 2}, target: {begin: 0, end: 2}}
  sentence(g, 2) // => {source: {begin: 0, end: 2}, target: {begin: 0, end: 2}}
  sentence(g, 3) // => {source: {begin: 3, end: 5}, target: {begin: 3, end: 5}}
  const g2 = modify_tokens(g, 1, 4, 'uff ! Hepp plepp ')
  target_text(g2) // => 'apa uff ! Hepp plepp depa . epa '
  sentence(g2, 0) // => {source: {begin: 0, end: 5}, target: {begin: 0, end: 6}}
  sentence(g2, 1) // => {source: {begin: 0, end: 5}, target: {begin: 0, end: 6}}
  sentence(g2, 2) // => {source: {begin: 0, end: 5}, target: {begin: 0, end: 6}}
  sentence(g2, 3) // => {source: {begin: 0, end: 5}, target: {begin: 0, end: 6}}
  const g3 = modify_tokens(g, 6, 7, '')
  target_text(g3) // => 'apa bepa . Cepa depa . '
  sentence(g3, 4) // => {source: {begin: 3, end: 6}, target: {begin: 3, end: 5}}
  sentence(g3, 5) // => {source: {begin: 3, end: 6}, target: {begin: 3, end: 5}}

*/
export function sentence(g: Graph, i: number): Subspan {
  let {source, target} = proto_sentence(g, i)
  if (target.begin > 0) {
    const prev = proto_sentence(g, target.begin - 1)
    source = T.span_merge(source, {begin: prev.source.end + 1, end: source.end})
  } else {
    source = T.span_merge(source, {begin: 0, end: source.end})
  }
  const N = target_texts(g).length
  if (target.end < N - 1) {
    const next = proto_sentence(g, target.end + 1)
    source = T.span_merge(source, {begin: source.begin, end: next.source.begin - 1})
  } else {
    source = T.span_merge(source, {begin: source.begin, end: source_texts(g).length - 1})
  }
  return {source, target}
}

/** All sentences in a text starting from an offset in the target text. */
export function sentences(g: Graph, begin: number = 0): Subspan[] {
  if (begin >= g.target.length) {
    return []
  } else {
    const s = sentence(g, begin)
    return [s].concat(sentences(g, s.target.end + 1))
  }
}

/** Given many graphs on the same source text, find the overlapping sentence groups

Uses merge_series which is very inefficient */
export function sentence_groups<K extends string>(gs: Record<K, Graph>): Record<K, Subspan>[] {
  return Utils.merge_series(record.map(gs, g => sentences(g)), subspan_merge, R.eqProps('source'))
}

export function proto_sentence(g: Graph, i: number): Subspan {
  const init = {
    source: {begin: g.source.length - 1, end: 0},
    target: target_sentence(g, i),
  }
  const em = edge_map(g)
  const sm = source_map(g)
  const tm = target_map(g)
  const unseen = Utils.unique_check()
  return Utils.fix(init, ({source, target}) => {
    const visit = (id0: string) => {
      const edge = em.get(id0)
      if (edge && unseen(edge.id)) {
        for (let id of edge.ids) {
          let i = tm.get(id)
          if (i !== undefined) {
            target = T.span_merge(target, target_sentence(g, i))
          }
          let j = sm.get(id)
          if (j !== undefined) {
            source = T.span_merge(source, {begin: j, end: j})
          }
        }
      }
    }
    for (let i = target.begin; i <= target.end; ++i) {
      const tid = g.target[i].id
      if (tid && unseen(tid)) {
        visit(tid)
      }
    }
    if (source.begin >= 0) {
      for (let i = source.begin; i <= source.end; ++i) {
        const sid = g.source[i].id
        if (sid && unseen(sid)) {
          visit(sid)
        }
      }
    }
    return {source, target}
  })
}

/** The subgraph from a subspan

  const g = init('apa bepa . cepa depa . epa')
  target_text(subgraph(g, sentence(g, 3))) // => 'cepa depa . '

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

/** Modify the labels at an identifier

  const g = init('word')
  const g2 = modify_labels(g, 'e-s0-t0', (labels: string[]) => [...labels, 'ABC'])
  const g3 = modify_labels(g2, 'e-s0-t0', (labels: string[]) => [...labels, 'DEF'])
  g3.edges['e-s0-t0'].labels // => ['ABC', 'DEF']

*/
export function modify_labels(g: Graph, edge_id: string, k: (labels: string[]) => string[]): Graph {
  const store = Store.init(g)
  const edge = edge_store(store, edge_id)
  edge.modify(e => Edge(e.ids, k(e.labels), e.manual))
  return store.get()
}

export function edge_store(g: Store<Graph>, edge_id: string): Store<Edge> {
  return g
    .at('edges')
    .via(Lens.key(edge_id))
    .via(Lens.def(Edge([], [])))
}

/** Revert at an edge id */
export function revert(g: Graph, edge_ids: string[]): Graph {
  return align(proto_revert(g, edge_ids))
}

/** Revert at an edge id */
export function proto_revert(g: Graph, edge_ids: string[]): Graph {
  const edge_set = new Set(edge_ids)
  const diff = calculate_raw_diff(g)
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
          return [Dragged(s, e.id, false), Dropped(t, e.id, false)]
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
  return from_raw_diff(reverted, edges)
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
    const edge_without = Edge(edge.ids.filter(i => i != id), edge.labels)
    const edge_with = Edge([id], [], true)
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
        e.labels,
        set_manual_to === 'keep' ? e.manual : set_manual_to
      )
      return [E.id, E] as [string, Edge]
    })
  )
  return {source, target, edges}
}

export function equal(g1: Graph, g2: Graph, set_manual_to: boolean | 'keep' = true): boolean {
  return R.equals(normalize(g1, set_manual_to), normalize(g2, set_manual_to))
}

/** Make all trailing whitespace of a specific form */
export function normalize_whitespace(g: Graph, ws = ' '): Graph {
  const on_tok = (s: Token) => Token((s.text.match(/\S+/) || [''])[0] + ws, s.id)
  return {...g, source: g.source.map(on_tok), target: g.target.map(on_tok)}
}

/** Invert the graph: swap source and target.

Note that this is not stable, ie not involutive since texts get automatically
realigned. This can make labels get transferred between groups.
*/
export function invert(g: Graph): Graph {
  const {source, target, edges} = g
  return align({source: target, target: source, edges})
}

export function from_unaligned(st: ST<{text: string; labels: string[]}[]>): Graph {
  const edges: Record<string, Edge> = {}
  const g = with_st(st, (toks, side) =>
    toks.map((tok, i) => {
      const id = side[0] + i
      const e = Edge([id], tok.labels, false)
      edges[id] = e
      return T.Token(tok.text, id)
    })
  )
  return align({...g, edges})
}
