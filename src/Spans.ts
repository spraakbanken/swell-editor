
console.log('Reload Spans')

export interface Span {
  readonly text: string,
  readonly links: number[],
  readonly labels: string[],
  readonly moved: boolean
}

/** Combine all data from several spans */
export function merge_spans(spans: Span[], text: string): Span {
  return {
    text: text,
    links: flatten(spans.map(s => s.links)),
    labels: flatten(spans.map(s => s.labels)),
    moved: spans.some(s => s.moved)
  }
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

/** Checks the invariants for spans, returns empty string if OK */
export function check_invariant(spans: Span[]): string {
  for (let i = 0; i < spans.length; i++) {
    const text = spans[i].text
    if (!text.match(/^\S(.|\n)*\s$/)) {
      if (i == 0 && text.match(/\s$/)) {
        // ok: first token does not need to start on a word,
        // but cannot be empty
      } else {
        return 'Content invariant violated on span ' + i + ' ' + text
      }
    }
  }
  for (let i = 0; i < spans.length; i++) {
    for (let j = 0; j < spans.length; j++) {
      if (spans[i].links.some((x) => spans[j].links.some((y) => x == y)) && i != j) {
        return 'Links injectivity invariant broken on indicies ' + i + ' and ' + j
      }
    }
  }
  let last = -1
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]
    if (!span.moved && span.links) {
      if (last > Math.min(...span.links)) {
        return 'Link increase invariant broken on index ' + i
      }
      last = Math.max(...span.links)
    }
  }
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]
    if (span.moved && span.links.length == 0) {
      return 'Span moved but without links on index ' + i
    }
  }
  return '' // all ok!
}

/** Flatten an array of arrays */
function flatten<A>(xss: A[][]): A[] {
  return ([] as any).concat(...xss)
}

function splitAt<A>(xs: A[], i: number): [A[], A[]] {
  return [xs.slice(0, i), xs.slice(i)]
}

/** Slicing and rearranging arrays. The to paramater is /exclusive/ */
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

