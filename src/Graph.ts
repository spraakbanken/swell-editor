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
      const unique_id = Utils.unique_check<string>()
      tokens.forEach(t => unique_id(t.id) || Utils.raise('Duplicate id: ' + t))
    }
    const check_tokens = (toks: string[]) => toks.forEach((t, i) => {
      if (i != toks.length - 1) {
        t.match(/^\s*\S+\s+$/) || Utils.raise('Bad text token: ' + JSON.stringify(t))
      } else {
        t.match(/^\s*\S+\s*$/) || Utils.raise('Bad last token: ' + JSON.stringify(t))
      }
    })
    check_tokens(target_texts(g))
    check_tokens(source_texts(g))
    const ids = new Set(tokens.map(t => t.id))
    {
      const unique_id = Utils.unique_check<string>()
      g.edges.forEach(e =>
        e.ids.forEach(id => {
          unique_id(id) || Utils.raise('Duplicate id in edge id list: ' + id)
          ids.has(id) || Utils.raise('Edge talks about unknown id: ' + id)
        }))
    }
  } catch (e) {
    console.error(e)
    console.error(JSON.stringify(g, undefined, 2))
    return {violation: e, g}
  }
  return 'ok'
}

/** Tokenizes text on whitespace, prefers to have trailing whitespace

  tokenize('') // => []
  tokenize('    ') // => []
  tokenize('apa bepa cepa') // => ['apa ', 'bepa ', 'cepa']
  tokenize('  apa bepa cepa') // => ['  apa ', 'bepa ', 'cepa']
  tokenize('  apa bepa cepa  ') // => ['  apa ', 'bepa ', 'cepa  ']

*/
export function tokenize(s: string): string[] {
  return s.match(/\s*\S+\s*/g) || []
}


/** Makes spans from an original text by tokenizing it and assumes no changes

  const g = init('w1 w2')
  const source = [{text: 'w1 ', id: 's0'}, {text: 'w2', id: 's1'}]
  const target = [{text: 'w1 ', id: 't0'}, {text: 'w2', id: 't1'}]
  const edges = [{ids: ['s0', 't0'], labels: []}, {ids: ['s1', 't1'], labels: []}]
  g // => {source, target, edges}

*/
export function init(s: string): Graph {
  return init_from(tokenize(s))
}

/** Makes a graph from tokens */
export function init_from(tokens: string[]): Graph {
  return {
    source: tokens.map((t, i) => ({text: t, id: 's' + i})),
    target: tokens.map((t, i) => ({text: t, id: 't' + i})),
    edges: tokens.map((_, i) => ({ids: ['s' + i, 't' + i], labels: []})),
  }
}

/** The edge at a position (in the target text)

  const g = init('apa bepa cepa')
  edge_at(g, 1) // => {ids: ['s1', 't1'], labels: []}

*/
export function edge_at(g: Graph, index: number): Edge {
  const target_id  = g.target[index].id
  for (const e of g.edges) {
    for (const id of  e.ids) {
      if (id == target_id) {
        return e
      }
    }
  }
  return Utils.raise('Out of bounds: ' + JSON.stringify({g, index}))
}

/** The related ids at a position (in the target text)

  const g = init('apa bepa cepa')
  related(g, 1) // => ['s1', 't1']

*/
export function related(g: Graph, index: number): string[] {
  return edge_at(g, index).ids
}

/** The text in some tokens

  text(init('apa bepa cepa ').target) // => 'apa bepa cepa '

*/
export function text(ts: Token[]): string {
  return texts(ts).join('')
}

/** The texts in some tokens

  texts(init('apa bepa cepa ').target) // => ['apa ', 'bepa ', 'cepa ']

*/
export function texts(ts: Token[]): string[] {
  return ts.map(t => t.text)
}


/** The text in the target

  target_text(init('apa bepa cepa ')) // => 'apa bepa cepa '

*/
export function target_text(g: Graph): string {
  return text(g.target)
}

/** The text in the source

  source_text(init('apa bepa cepa ')) // => 'apa bepa cepa '

*/
export function source_text(g: Graph): string {
  return text(g.source)
}

/** The texts in the target

  target_texts(init('apa bepa cepa ')) // => ['apa ', 'bepa ', 'cepa ']

*/
export function target_texts(g: Graph): string[] {
  return texts(g.target)
}

/** The texts in the source

  source_texts(init('apa bepa cepa ')) // => ['apa ', 'bepa ', 'cepa ']

*/
export function source_texts(g: Graph): string[] {
  return texts(g.source)
}

/**

  const abc = ['012', '3456', '789']
  token_at(abc, 0) // => {token: 0, offset: 0}
  token_at(abc, 2) // => {token: 0, offset: 2}
  token_at(abc, 3) // => {token: 1, offset: 0}
  token_at(abc, 6) // => {token: 1, offset: 3}
  token_at(abc, 7) // => {token: 2, offset: 0}
  token_at(abc, 9) // => {token: 2, offset: 2}
  Utils.throws(() => token_at(abc, 10)) // => true

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
  return Utils.raise('Out of bounds: ' + JSON.stringify({tokens, character_offset}))
}

/** Replace the text at some position, merging the spans it touches upon.

  const show = (g: Graph) => g.target.map(t => t.text)
  const ids = (g: Graph) => g.target.map(t => t.id).join(' ')
  const g = init('test graph hello')
  show(g) // => ['test ', 'graph ', 'hello']
  show(modify(g, 0, 0, 'NEW')) // => ['NEWtest ', 'graph ', 'hello']
  show(modify(g, 0, 1, 'NEW')) // => ['NEWest ', 'graph ', 'hello']
  show(modify(g, 0, 5, 'NEW ')) // => ['NEW ', 'graph ', 'hello']
  show(modify(g, 0, 5, 'NEW')) // => ['NEWgraph ', 'hello']
  show(modify(g, 5, 5, ' ')) // => ['test ', ' graph ', 'hello']
  show(modify(g, 5, 6, ' ')) // => ['test ', ' raph ', 'hello']
  check_invariant(modify(g, 0, 0, 'NEW'))  // => 'ok'
  check_invariant(modify(g, 0, 1, 'NEW'))  // => 'ok'
  check_invariant(modify(g, 0, 5, 'NEW ')) // => 'ok'
  check_invariant(modify(g, 0, 5, 'NEW'))  // => 'ok'
  check_invariant(modify(g, 5, 5, ' '))    // => 'ok'
  check_invariant(modify(g, 5, 6, ' '))    // => 'ok'

Indexes are character offsets (use CodeMirror's doc.posFromIndex and doc.indexFromPos to convert) */
export function modify(g: Graph, from: number, to: number, text: string): Graph {
  const tokens = target_texts(g)
  const {token: from_token, offset: from_ix} = token_at(tokens, from)
  const {token: to_token, offset: to_ix} = token_at(tokens, to)
  const slice = g.target.slice(from_token, to_token + 1)
  const pre = slice.length > 0 ? slice[0].text.slice(0, from_ix) : ""
  const post = slice.length > 0 ? slice[slice.length - 1].text.slice(to_ix) : ""
  return modify_tokens(g, from_token, to_token + 1, pre + text + post)
}

/** Replace the text at some position, merging the spans it touches upon.

  const show = (g: Graph) => g.target.map(t => t.text)
  const ids = (g: Graph) => g.target.map(t => t.id).join(' ')
  const g = init('test graph hello')
  show(g) // => ['test ', 'graph ', 'hello']
  show(modify_tokens(g, 0, 0, 'this '))     // => ['this ', 'test ', 'graph ', 'hello']
  show(modify_tokens(g, 0, 1, 'this '))     // => ['this ', 'graph ', 'hello']
  show(modify_tokens(g, 0, 1, '  white '))  // => ['  white ', 'graph ', 'hello']
  show(modify_tokens(g, 0, 1, 'this'))      // => ['thisgraph ', 'hello']
  show(modify_tokens(g, 1, 2, 'graph'))     // => ['test ', 'graphhello']
  show(modify_tokens(g, 1, 2, ' graph '))   // => ['test ', ' graph ', 'hello']
  show(modify_tokens(g, 0, 1, 'for this ')) // => ['for ', 'this ', 'graph ', 'hello']
  show(modify_tokens(g, 0, 2, '')) // => ['hello']
  show(modify_tokens(g, 0, 2, '  ')) // => ['  hello']
  show(modify_tokens(g, 1, 3, '  ')) // => ['test   ']
  ids(g) // => 't0 t1 t2'
  ids(modify_tokens(g, 0, 0, 'this '))     // => 't3 t0 t1 t2'
  ids(modify_tokens(g, 0, 1, 'this '))     // => 't3 t1 t2'
  ids(modify_tokens(g, 0, 1, 'this'))      // => 't3 t2'
  ids(modify_tokens(g, 1, 2, 'graph'))     // => 't0 t3'
  ids(modify_tokens(g, 1, 2, ' graph '))   // => 't0 t3 t2'
  ids(modify_tokens(g, 0, 1, 'for this ')) // => 't3 t4 t1 t2'

Indexes are token offsets */
export function modify_tokens(g: Graph, from: number, to: number, text: string): Graph {
  if (text.match(/^\s+$/)) {
    // replacement text is only whitespace, need to find some token to put it on
    if (from > 0) {
      // does this mean to prefer to merge with previous?
      return modify_tokens(g, from - 1, to, g.target[from - 1].text + text)
    } else if (to < g.target.length) {
      return modify_tokens(g, from, to + 1, text + g.target[to].text)
    } else {
      // console.warn('Introducing whitespace into empty graph')
    }
  }
  // console.error(JSON.stringify({g, from, to, text}, undefined, 2))
  // if (text.match(/^\s/) && from > 0) {
  //   // if replacement text starts with whitespace, grab the previous word as well
  //   return modify_tokens(g, from - 1, to, g.target[from-1].text + text)
  // }
  if (text.match(/\S$/) && to < g.target.length) {
    // if replacement text does not end with whitespace, grab the next word as well
    return modify_tokens(g, from, to + 1, text + g.target[to].text)
  }
  // if (text.match(/\S$/) && to == g.target.length) {
  //   // if replacement text does not end with whitespace and we're at the end of text, add some whitespace
  //   return modify_tokens(g, from, to, text + ' ')
  // }

  const id_offset = next_id(g.target.map(t => t.id))
  const tokens = tokenize(text).map((t, i) => ({text: t, id: 't' + (id_offset + i)}))
  const [target, removed] = Utils.splice(g.target, from, to - from, ...tokens)
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
  return Utils.raise('todo')
}

/** Calculate the diff */
export function calculate_diff(graph: Graph): Spans.Diff[] {
  return Utils.raise('todo')
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

