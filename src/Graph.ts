import * as Utils from './Utils'
import * as Spans from './Spans'

export interface Graph {
  readonly source: Token[],
  readonly target: Token[],
  readonly edges: Edge[]
}

export interface Token {
  readonly text: string,
  readonly id: string
}

export interface Edge {
  readonly ids: string[],
  readonly labels: string[]
}

/**

  const u = unique_check()
  u(1) // => true
  u(1) // => false
  u(1) // => false
  u(2) // => true
  u(3) // => true
  u(2) // => false

*/
function unique_check<S>(): (s: S) => boolean {
  const seen = new Set<S>()
  return s => {
    if (seen.has(s)) {
      return false
    }
    seen.add(s)
    return true
  }
}

function raise<A>(s: string): A {
  throw s
}

/** Checks that the invariant of the graph holds

  check_invariant(init('apa bepa cepa')) // => 'ok'

Do we need that each token is associated with some edge?
If an edge is associated with at least two nodes on one side, it should be
associated with some on the other side too? (This is not checked)

*/
export function check_invariant(g: Graph): 'ok' | {violation: string, g: Graph} {
  try {
    const tokens = g.source.concat(g.target)
    {
      const unique_id = unique_check<string>()
      tokens.forEach(t => unique_id(t.id) || raise('Duplicate id: ' + t))
    }
    tokens.forEach(t => t.text.match(/^\S+\s+$/) || raise('Bad text token: ' + JSON.stringify(t.text)))
    const ids = new Set(tokens.map(t => t.id))
    {
      const unique_id = unique_check<string>()
      g.edges.forEach(e =>
        e.ids.forEach(id => {
          unique_id(id) || raise('Duplicate id in edge id list: ' + id)
          ids.has(id) || raise('Edge talks about unknown id: ' + id)
        }))
    }
  } catch (e) {
    console.error(e)
    console.error(JSON.stringify(g, undefined, 2))
    return {violation: e, g}
  }
  return 'ok'
}

/** Tokenizes text on whitespace, with a trailing whitespace

  init_tokenize('apa bepa cepa') // => ['apa ', 'bepa ', 'cepa ']
  init_tokenize('apa bepa cepa ') // => ['apa ', 'bepa ', 'cepa ']
  init_tokenize('apa bepa cepa  ') // => ['apa ', 'bepa ', 'cepa ']

*/
export function init_tokenize(s: string): string[] {
  const lts = s.trim()
  if (lts.length > 0) {
    return tokenize(lts + ' ')
  } else {
    return [] as string[]
  }
}

/** Tokenizes text on whitespace

  tokenize('apa bepa cepa') // => ['apa ', 'bepa ', 'cepa']

*/
export function tokenize(s: string): string[] {
  return s.match(/\S+\s*/g) || []
}


/** Makes spans from an original text by tokenizing it and assumes no changes

  const g = init('w1 w2')
  const source = [{text: 'w1 ', id: 's0'}, {text: 'w2 ', id: 's1'}]
  const target = [{text: 'w1 ', id: 't0'}, {text: 'w2 ', id: 't1'}]
  const edges = [{ids: ['s0', 't0'], labels: []}, {ids: ['s1', 't1'], labels: []}]
  g // => {source, target, edges}

*/
export function init(s: string): Graph {
  return init_from(init_tokenize(s))
}

/** Makes a graph from tokens */
export function init_from(tokens: string[]): Graph {
  return {
    source: tokens.map((t, i) => ({text: t, id: 's' + i})),
    target: tokens.map((t, i) => ({text: t, id: 't' + i})),
    edges: tokens.map((_, i) => ({ids: ['s' + i, 't' + i], labels: []})),
  }
}

/**

  const abc = ['012', '3456', '789']
  token_at(abc, 0) // => {token: 0, offset: 0}
  token_at(abc, 2) // => {token: 0, offset: 2}
  token_at(abc, 3) // => {token: 1, offset: 0}
  token_at(abc, 6) // => {token: 1, offset: 3}
  token_at(abc, 7) // => {token: 2, offset: 0}
  token_at(abc, 9) // => {token: 2, offset: 2}

*/
export function token_at(tokens: string[], character_offset: number): {token: number, offset: number} {
  let passed = 0
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i].length
    passed += w
    if (passed > character_offset) {
      return {token: i, offset: character_offset - passed + w}
    }
  }
  throw new Error('Out of bounds')
}

/** Replace the text at some position, merging the spans it touches upon.

  const show = (g: Graph) => g.target.map(t => t.text)
  const ids = (g: Graph) => g.target.map(t => t.id).join(' ')
  const g = init('test graph hello')
  show(g) // => ['test ', 'graph ', 'hello ']
  show(modify(g, 0, 0, 'NEW')) // => ['NEWtest ', 'graph ', 'hello ']
  show(modify(g, 0, 1, 'NEW')) // => ['NEWest ', 'graph ', 'hello ']
  show(modify(g, 0, 5, 'NEW ')) // => ['NEW ', 'graph ', 'hello ']
  show(modify(g, 0, 5, 'NEW')) // => ['NEWgraph ', 'hello ']
  show(modify(g, 5, 5, ' ')) // => ['test  ', 'graph ', 'hello ']
  show(modify(g, 5, 6, ' ')) // => ['test  ', 'raph ', 'hello ']
  check_invariant(modify(g, 0, 0, 'NEW'))  // => 'ok'
  check_invariant(modify(g, 0, 1, 'NEW'))  // => 'ok'
  check_invariant(modify(g, 0, 5, 'NEW ')) // => 'ok'
  check_invariant(modify(g, 0, 5, 'NEW'))  // => 'ok'
  check_invariant(modify(g, 5, 5, ' '))    // => 'ok'
  check_invariant(modify(g, 5, 6, ' '))    // => 'ok'

Indexes are character offsets (use CodeMirror's doc.posFromIndex and doc.indexFromPos to convert) */
export function modify(g: Graph, from: number, to: number, text: string): Graph {
  const target_tokens = g.target.map(t => t.text)
  const {token: from_token, offset: from_ix} = token_at(target_tokens, from)
  const {token: to_token, offset: to_ix} = token_at(target_tokens, to)
  const slice = g.target.slice(from_token, to_token + 1)
  const pre = slice.length > 0 ? slice[0].text.slice(0, from_ix) : ""
  const post = slice.length > 0 ? slice[slice.length - 1].text.slice(to_ix) : ""
  return modify_tokens(g, from_token, to_token, pre + text + post)
}

/** Replace the text at some position, merging the spans it touches upon.

  const show = (g: Graph) => g.target.map(t => t.text)
  const ids = (g: Graph) => g.target.map(t => t.id).join(' ')
  const g = init('test graph hello')
  show(g) // => ['test ', 'graph ', 'hello ']
  show(modify_tokens(g, 0, 0, 'this '))     // => ['this ', 'graph ', 'hello ']
  show(modify_tokens(g, 0, 0, 'this'))      // => ['thisgraph ', 'hello ']
  show(modify_tokens(g, 1, 1, 'graph'))     // => ['test ', 'graphhello ']
  show(modify_tokens(g, 1, 1, ' graph '))   // => ['test  ', 'graph ', 'hello ']
  show(modify_tokens(g, 0, 0, 'for this ')) // => ['for ', 'this ', 'graph ', 'hello ']
  ids(g) // => 't0 t1 t2'
  ids(modify_tokens(g, 0, 0, 'this '))     // => 't3 t1 t2'
  ids(modify_tokens(g, 0, 0, 'this'))      // => 't3 t2'
  ids(modify_tokens(g, 1, 1, 'graph'))     // => 't0 t3'
  ids(modify_tokens(g, 1, 1, ' graph '))   // => 't3 t4 t2'
  ids(modify_tokens(g, 0, 0, 'for this ')) // => 't3 t4 t1 t2'

Indexes are token offsets */
export function modify_tokens(g: Graph, from: number, to: number, text: string): Graph {
  // console.error(JSON.stringify({g, from, to, text}, undefined, 2))
  if (text.match(/^\s/) && from > 0) {
    // if replacement text starts with whitespace, grab the previous word as well
    return modify_tokens(g, from - 1, to, g.target[from-1].text + text)
  }
  if (text.match(/\S$/) && to < g.target.length - 1) {
    // if replacement text does not end with whitespace, grab the next word as well
    return modify_tokens(g, from, to + 1, text + g.target[to + 1].text)
  }
  if (text.match(/\S$/) && to == g.target.length - 1) {
    // if replacement text does not end with whitespace and we're at the end of text, add some whitespace
    return modify_tokens(g, from, to, text + ' ')
  }

  const id_offset = next_id(g.target.map(t => t.id))
  const tokens = tokenize(text).map((t, i) => ({text: t, id: 't' + (id_offset + i)}))
  const [target, removed] = Utils.splice(g.target, from, to - from + 1, ...tokens)
  const ids_removed = new Set(removed.map(t => t.id))
  const new_edge_ids = new Set<string>(tokens.map(t => t.id))
  const new_edge_labels = new Set<string>()
  const edges = g.edges.filter(e => {
    if (e.ids.some(id => ids_removed.has(id))) {
      e.ids.forEach(id => ids_removed.has(id) || new_edge_ids.add(id))
      e.labels.forEach(lbl => new_edge_labels.add(lbl))
      return false
    } else {
      return true
    }
  })
  edges.push({ids: [...new_edge_ids], labels: [...new_edge_labels]})
  return {source: g.source, target, edges}
}

/** Moves a slice of the spans and puts it at a new destination (marking them as moved).

Indexes are token offsets
*/
export function rearrange(graph: Graph, begin: number, end: number, dest: number): Graph {
  return raise('todo')
}

/** Calculate the diff */
export function calculate_diff(graph: Graph): Spans.Diff[] {
  return raise('todo')
}

/** Calculate the next id to use from these identifiers

  next_id([]) // => 0
  next_id(['t1', 't2', 't3']) // => 4
  next_id(['u2v5k1', 'b3', 'a0']) // => 6
  next_id(['77j66']) // => 78

*/
export function next_id(xs: string[]): number {
  let max = -1
  xs.forEach(x => (x.match(/\d+/g) || []).forEach(i => max = Math.max(max, parseInt(i))))
  return max + 1
}

