import { isArray } from "lodash"

console.log('Reload Spans')

export interface Span {
  readonly text: string,
  readonly links: number[],
  readonly labels: string[],
  readonly moved: boolean
}

/** Combine all data from several spans */
export function merge_spans(spans: Span[], text: string): Span {
  const links = flatten(spans.map(s => s.links))
  return {
    text: text,
    labels: flatten(spans.map(s => s.labels)),
    links: numsort(links),
    moved: spans.some(s => s.moved) || !contiguous(links)
  }
}

/** Numeric sort */
export function numsort(xs: number[]): number[] {
  return xs.slice().sort((u,v) => u - v)
}

/** Tokenizes text on whitespace */
export function tokenize(s: string): string[] {
  return (s + ' ').match(/\S*\s+/g) || []
}

/** Makes spans from an original text by tokenizing it and assumes no changes */
export const identity_spans: (s: string) => Span[] = (s) => init(tokenize(s))

/** Makes spans from tokens */
export function init(tokens: string[]): Span[] {
  return tokens.map((s, i) => ({
    text: s,
    links: [i],
    labels: [],
    moved: false
  }))
}

export function increases(xs: number[]): boolean {
  return xs.every((v, i) => i == 0 || v > xs[i-1])
}

export function contiguous(xs: number[]): boolean {
  return xs.every((x, i) => i == 0 || xs[i-1] == x - 1)
}

/** Checks the invariants for spans, returns empty string if OK */
export function check_invariant(spans: Span[]): string {
  for (let i = 0; i < spans.length; i++) {
    const text = spans[i].text
    if (!text.match(/^\S(.|\n)*\s$/)) {
      if (i == 0 && text.match(/\s$/)) {
        // ok: first token does not need to start on a word,
        // but cannot be empty
      } else {
        return 'Content invariant violated at index ' + i + ': ' + text
      }
    }
  }
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]
    if (!span.moved && !contiguous(span.links)) {
      return 'Links not contiguous on unmoved span at index ' + i
    }
    if (!increases(span.links)) {
      return 'Links not sorted at index ' + i
    }
    if (span.moved && span.links.length == 0) {
      return 'Span moved but without links at index ' + i
    }
  }
  for (let i = 0; i < spans.length; i++) {
    for (let j = 0; j < spans.length; j++) {
      if (spans[i].links.some((x) => spans[j].links.some((y) => x == y)) && i != j) {
        return 'Links injectivity invariant broken at indicies ' + i + ' and ' + j
      }
    }
  }
  if (!increases(flatten(spans.filter(s => !s.moved).map(s => s.links)))) {
    return 'Links not increasing'
  }
  return '' // all ok!
}

/** Flatten an array of arrays */
export function flatten<A>(xss: A[][]): A[] {
  return ([] as any).concat(...xss)
}

/** Split an array into two pieces */
function splitAt<A>(xs: A[], i: number): [A[], A[]] {
  return [xs.slice(0, i), xs.slice(i)]
}

/** Split an array into three pieces */
function splitAt3<A>(xs: A[], start: number, end: number): [A[], A[], A[]] {
  const [ab,c] = splitAt(xs, end)
  const [a,b] = splitAt(ab, start)
  return [a,b,c]
}

/** Moves a slice of the spans and puts it at a new destination (marking them as moved).

Indexes are spans, not offsets.
*/
export function rearrange(spans: Span[], begin: number, end: number, dest: number): Span[] {
  const bumped_end = end + 1
  const [before, seg, after] = splitAt3(spans, begin, bumped_end)
  function mark_moved(span: Span): Span {
    return {...span, moved: span.links.length > 0}
  }
  const mod_dest = dest - (dest >= bumped_end ? bumped_end - begin : 0)
  const [a,b] = splitAt(flatten([before, after]), mod_dest)
  return flatten([a, seg.map(mark_moved), b])
}

/** Replace the text at some position, merging the spans it touches upon.

Positions are offsets from the beginning of text.
(use CodeMirror's doc.posFromIndex and doc.indexFromPos to convert */
export function modify(spans: Span[], from: number, to: number, text: string): Span[] {
  const [from_span, from_ix] = span_from_offset(spans, from)
  let [to_span, to_ix] = span_from_offset(spans, to - 1)
  const [before, seg, after] = splitAt3<Span>(spans, from_span, to_span+1)
  const pre = seg.length > 0 ? seg[0].text.slice(0, from_ix) : ""
  const post = seg.length > 0 ? seg[seg.length - 1].text.slice(to_ix + 1) : ""
  const new_span: Span = merge_spans(seg, pre + text + post)
  return cleanup_after_raw_modifications(flatten([before, [new_span], after]))
}

/** Modify the spans using a sliding window of width one.

Goes through the array backwards in case the size changes.

Return null for no change.
*/
export function cursor<S>(f: ((prev: S | null, me: S, next: S | null) => (S | null)[] | null)): (spans: S[]) => S[] {
  return (spans) => {
    for (let i = spans.length - 1; i >= 0; i--) {
      const prev = i > 0 ? spans[i-1] : null
      const next = i < spans.length - 1 ? spans[i+1] : null
      const replace = f(prev, spans[i], next)
      if (replace != null) {
        spans = flatten([spans.slice(0, Math.max(i-1,0)), replace.filter((x) => x != null) as S[], spans.slice(i+2)])
      }
    }
    return spans
  }
}

/** Reverts a span if it matches the original exactly.

Only performed when this breaks up a span into many, and they are not moved */
export function auto_revert(spans: Span[], original: string[]): Span[] {
  return cursor<Span>((prev, me, next) => {
    if (me.links.length > 1 &&
        !me.moved &&
        me.text == me.links.map((i) => original[i]).join('')) {
      const reverted_spans: Span[] = me.links.map((i) => ({
        text: original[i],
        links: [i],
        labels: [],
        moved: false
      }))
      return [prev].concat(reverted_spans, [next])
    } else {
      return null
    }
  })(spans)
}


/** Shuffles initial whitespace from a token to the previous one */
const move_whitespace: (spans: Span[]) => Span[] =
  cursor<Span>((prev, me, next) => {
    if (!prev) {
      return null // no change
    } else {
      const m = me.text.match(/^\s+/)
      if (m) {
        const new_prev = {...prev, text: prev.text + m[0]}
        const new_me = {...me, text: me.text.slice(m[0].length)}
        return [new_prev, new_me, next]
      } else {
        return null // no change
      }
    }
  })

/** Remove empty spans */
const remove_empty: (spans: Span[]) => Span[] =
  cursor<Span>((prev, me, next) => {
    if (me.text.length == 0) {
      return [prev, next]
    } else {
      return null // no change
    }
  })

/** Merge tokens which have no final whitespace with next token */
const merge_no_final_whitespace: (spans: Span[]) => Span[] =
  cursor<Span>((prev, me, next) => {
    if (me.text.match(/\S$/) && next) {
      const new_me_next = merge_spans([me, next], text([me, next]))
      return [prev, new_me_next]
    } else {
      return null // no change
    }
  })

/** Clean up after modifications */
function cleanup_after_raw_modifications(spans: Span[]): Span[] {
  const new_spans = merge_no_final_whitespace(remove_empty(move_whitespace(spans)))
  const len = spans.reduce((n, s) => n + s.text.length, 0)
  const new_len = new_spans.reduce((n, s) => n + s.text.length, 0)
  if (len != new_len) {
    throw new Error('Internal error: length modified')
  }
  //check_invariant(new_spans)
  return new_spans
}

/** The total text length */
export function text_length(spans: Span[]): number {
  return text(spans).length
}

/** The text */
export function text(spans: Span[]): string {
  return spans.map(s => s.text).join('')
}

/** The offset in the modified text for a span at an index. */
export function span_offset(spans: Span[], index: number): number {
  return spans.slice(0, index).reduce((x, s: Span) => x + s.text.length, 0)
}

/** The span index and position in it from an offset in the modified text */
export function span_from_offset(spans: Span[], offset: number): [number, number] {
  let passed = 0
  for (let i = 0; i < spans.length; i++) {
    const w = spans[i].text.length
    passed += w
    if (passed > offset) {
      return [i, offset - passed + w]
    }
  }
  throw new Error('Out of bounds')
}

export type Diff
  = { kind: 'Unchanged', source: string }
  | { kind: 'Edited', now: string, source: string[] }
  | { kind: 'Dropped', now: string, source_and_ids: [string, number][] }
  | { kind: 'Dragged', source: string, id: number }
  | { kind: 'Inserted', now: string }
  | { kind: 'Deleted', source: string }

function Unchanged(source: string): Diff {
  return { kind: 'Unchanged', source }
}

function Edited(now: string, source: string[]): Diff {
  if (now == source.join('')) {
    return Unchanged(now)
  } else {
    return { kind: 'Edited', now, source }
  }
}

function Dropped(now: string, source_and_ids: [string, number][]): Diff {
  return { kind: 'Dropped', now , source_and_ids }
}

function Dragged(source: string, id: number): Diff {
  return { kind: 'Dragged', source, id }
}

function Inserted(now: string): Diff {
  return { kind: 'Inserted', now }
}

function Deleted(source: string): Diff {
  return { kind: 'Deleted', source }
}

/**
This is a translation of this algorithm:

diff (Span text [] false : spans)    ss = Inserted text : diff spans ss
diff (Span text links false : spans) ss0@((s,j):ss)
  | j == links[0]        = edited text (concatMap s (take links.length ss0))
                         : diff spans (drop links.length ss0)
  | j `elem` unlinked    = Dragged s (Span text links false : spans) ss
  | j `notElem` unlinked = Deleted s (Span text links false : spans) ss
diff (Span text links true : spans) ss = Dropped text (concatMap (! unlinked) links) : diff spans ss
diff [] ss = map (Deleted . fst) ss
*/
export function calculate_diff(spans: Span[], tokens: string[]): Diff[] {
  const moved = new Map<number, {}>()
  spans.map((s, i) => {
    if (s.moved) {
      s.links.map(j => moved.set(j, {}))
    }
  })
  let i = 0
  let j = 0
  const out: Diff[] = []
  function Gone() {
    const u = moved.get(j)
    if (u) {
      out.push(Dragged(tokens[j], j))
      j++
    } else {
      out.push(Deleted(tokens[j]))
      j++
    }
  }
  while (i < spans.length) {
    const span = spans[i]
    if (span.links.length == 0) {
      out.push(Inserted(span.text))
      i++
    } else if (span.moved) {
      out.push(Dropped(span.text, span.links.map((t) => [tokens[t], t] as [string, number])))
      i++
    } else if (j == span.links[0]) {
      out.push(Edited(span.text, span.links.map((t) => tokens[t])))
      i++
      j+=span.links.length
    } else {
      Gone()
    }
  }
  tokens.slice(j).map(Gone)
  return out
}

type Children = (Element | string | [string, string])[]

export function export_to_xml(diff: Diff[]): Element {
  const xml = document.implementation.createDocument(null, null, null);
  function node(tag_name: string): (...children: Children) => Element {
    return (...children) => {
      const ret = xml.createElement(tag_name)
      for (const child of children) {
        if (typeof child === 'string') {
          ret.appendChild(xml.createTextNode(child))
        } else if (isArray(child)) {
          ret.setAttribute(child[0], child[1])
        } else {
          ret.appendChild(child)
        }
      }
      return ret
    }
  }
  const h = (s: string) => ['h', s] as [string, string]
  const id = (i: number) => ['id', i + ''] as [string, string]
  const t = node('target')
  const w = node('w')
  const m = node('moved')
  return node('corpus')(...diff.map((d) => {
    switch (d.kind) {
      case 'Unchanged':
        return w(d.source)
      case 'Edited':
        if (d.source.length == 1) {
          return w(h(d.now), d.source[0])
        } else {
          return t(h(d.now), ...d.source.map((s) => w(s)))
        }
      case 'Dropped':
        if (d.source_and_ids.length == 1) {
          return m(h(d.now), id(d.source_and_ids[0][1]))
        } else {
          return t(h(d.now), ...d.source_and_ids.map(x => m(id(x[1]))))
        }
      case 'Dragged':
        return w(h(''), ['id', d.id + ''], d.source)
      case 'Inserted':
        return t(h(d.now))
      case 'Deleted':
        return w(h(''), d.source)
    }
  }))
}
