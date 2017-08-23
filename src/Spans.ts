


console.log('Reload Spans')

export interface SpanData {
  readonly links: number[],
  readonly labels: string[],
  readonly moved: boolean
}

export interface Span {
  readonly text: string,
  readonly data: SpanData,
}

/** Combine all data from several spans */
export function merge_data(spans: Span[]): SpanData {
  return {
    links: flatten(spans.map(s => s.data.links)),
    labels: flatten(spans.map(s => s.data.labels)),
    moved: spans.some(s => s.data.moved)
  }
}

/** Makes spans from an original text by tokenizing it and assumes no changes */
export function identity_spans(original: string): Span[] {
  const segments = (original + ' ').match(/\S*\s+/g) || []
  return segments.map((s, i) => ({
    text: s,
    data: {
      links: [i],
      labels: [],
      moved: false
    }
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
      if (spans[i].data.links.some((x) => spans[j].data.links.some((y) => x == y)) && i != j) {
        return 'Links injectivity invariant broken on indicies ' + i + ' and ' + j
      }
    }
  }
  let last = -1
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]
    if (!span.data.moved && span.data.links) {
      if (last > Math.min(...span.data.links)) {
        return 'Link increase invariant broken on index ' + i
      }
      last = Math.max(...span.data.links)
    }
  }
  return ''
}

/** Flatten an array of arrays */
function flatten<A>(xss: A[][]): A[] {
  return ([] as any).concat(...xss)
}

/** Slicing and rearranging arrays. The to paramater is /exclusive/ */
function splitAt<A>(xs: A[], start: number, end: number=start+1): [A[], A[], A[]] {
  return [xs.slice(0, start), xs.slice(start, end), xs.slice(end)]
}

function swap_slices<A>(xs: A[], begin1: number, end1: number, begin2: number, end2: number): A[] {
  if (begin2 < begin1) {
    return swap_slices(xs, begin2, end2, begin1, end1)
  } else if (begin2 < end1 || end2 < end1) {
    console.log('one is contained in the other: cannot do anything')
    console.log(begin1, end1, begin2, end2)
    return xs
  } else {
    const [before2, seg2, after2] = splitAt(xs, begin2, end2)
    const [before1, seg1, between] = splitAt(before2, begin1, end1)
    return flatten([before1, seg2, between, seg1, after2])
  }
}

/** Moves a slice of the spans and puts it at a new destination (marking them as moved).

Indexes are spans, not offsets.
*/
export function rearrange(spans: Span[], begin: number, end: number, destination: number): Span[] {
  const [before, seg, after] = splitAt(spans, begin, end + 1)
  function mark_moved(span: Span): Span {
    return {...span, data: {...span.data, moved: true}}
  }
  const marked_spans = flatten([before, seg.map(mark_moved), after])
  return swap_slices(marked_spans, begin, end + 1, destination, destination)
}

/** Replace the text at some position, merging the spans it touches upon.

Positions are offsets from the beginning of text.
(use CodeMirror's doc.posFromIndex and doc.indexFromPos to convert */
export function modify(spans: Span[], from: number, to: number, text: string): Span[] {
  const [from_span, from_ix] = span_from_offset(spans, from)
  let [to_span, to_ix] = span_from_offset(spans, to - 1)
  const before = spans.slice(0, from_span)
  const after = spans.slice(to_span + 1)
  const pre = spans[from_span].text.slice(0, from_ix)
  const post = spans[to_span].text.slice(to_ix + 1)
  const new_span: Span = {
    text: pre + text + post,
    data: merge_data(spans.slice(from_span, to_span+1))
  }
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
    if (me.data.links.length > 1 &&
        !me.data.moved &&
        me.text == me.data.links.map((i) => original[i]).join('')) {
      const reverted_spans: Span[] = me.data.links.map((i) => ({
        text: original[i],
        data: {
          links: [i],
          labels: [],
          moved: false
        }
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
      //console.debug('Removing span with data:', me.data)
      return [prev, next]
    } else {
      return null // no change
    }
  })

/** Merge tokens which have no final whitespace with next token */
const merge_no_final_whitespace: (spans: Span[]) => Span[] =
  cursor<Span>((prev, me, next) => {
    if (me.text.match(/\S$/) && next) {
      const new_me_next = {
        text: [me, next].map(s => s.text).join(''),
        data: merge_data([me, next])
      }
      return [prev, new_me_next]
    } else {
      return null // no change
    }
  })

/** Clean up after modifications */
function cleanup_after_raw_modifications(spans: Span[]): Span[] {
  const new_spans = merge_no_final_whitespace(remove_empty(move_whitespace(spans)))
  //console.group('cleanup_after_raw_modifications')
  //console.log('old', spans.map(x => x.text))
  //console.log('new', new_spans.map(x => x.text))
  //console.groupEnd()
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

// Tests

// test cursor
for (let i = 0; i < 100; i++) {
  const arr = randomString(i, 'xyz').split('')
  const arr2 = cursor((prev, me, next) => [prev, me, next])(arr)
  if (arr.some((x, i) => arr2[i] != x)) {
    throw new Error('cursor identity failed')
  }
}

// test splitAt
for (let i = 0; i < 100; i++) {
  const arr = randomString(i, 'xyz').split('')
  const a = Math.floor(Math.random() * arr.length)
  const b = Math.floor(Math.random() * (arr.length + 1))
  const [start, stop] = [a, b].sort((x, y) => x - y)
  const [prev, mid, after] = splitAt(arr, start, stop)
  const arr2 = flatten([prev, mid, after])
  if (arr.some((x, i) => arr2[i] != x)) {
    throw new Error('splitAt identity failed')
  }
}

// test swapSlices
for (let n = 0; n < 100; n++) {
  const a = Math.floor(Math.random() * n)
  const b = Math.floor(Math.random() * n)
  const c = Math.floor(Math.random() * n)
  const d = Math.floor(Math.random() * (n + 1))
  const [f1, t1, f2, t2] = [a, b, c, d].sort((x, y) => x - y)
  const arr: number[] = []
  for (let i = 0; i < n; i++) {
    arr.push(i)
  }
  const arr2: number[] = swap_slices(arr, f1, t1, f2, t2)
  const arr3: number[] = []
  let f2c = f2
  let t1c = t1
  let f1c = f1
  for (let i = 0; i < f1; i++) { arr3.push(i) }
  for (let i = 0; i < t2 - f2; i++) { arr3.push(f2c++) }
  for (let i = 0; i < f2 - t1; i++) { arr3.push(t1c++) }
  for (let i = 0; i < t1 - f1; i++) { arr3.push(f1c++) }
  for (let i = t2; i < n; i++) { arr3.push(i) }
  if (arr.length != arr2.length) {
    throw new Error('swapSlices spec failed')
  }
  if (arr2.length != arr3.length) {
    throw new Error('swapSlices spec failed')
  }
  for (let i = 0; i < n; i++) {
    if (arr2[i] != arr3[i]) {
      throw new Error('swapSlices spec failed')
    }
  }
}

function dummy_span(text: string) {
  return {text, data: {links: [], labels: [], moved: false}}
}

// isolated test cases that have failed before
cleanup_after_raw_modifications([' ', 'x', 'ad  '].map(dummy_span))
modify(identity_spans(' ad  '), 1, 1, 'x').map(s => s.text)
modify(identity_spans('c  ed '), 0, 3, 'z  ').map(s => s.text)

/*
for (let i = 0; i < 9; i++) {
  console.log(span_index([exspan('text '), exspan('abcdef ')], i))
}

console.log(modify(['text '].map(exspan), 1, 3, 'ES').map(s => s.text))
for (let i = 1; i < 11; i++) {
  console.log(modify(['abc ', 'defg ', 'hi '].map(exspan), 1, i, 'X Y').map(s => s.text))
}

for (let i = 12; i < 24; i++) {
  console.log(modify(identity_spans('På min telefon. Det väder var inte fint'), 12, i, '').map(s => s.text))
}
*/

function randomString(n: number, alphabet: string): string {
  const r = []
  for (let i = 0; i < n; i++) {
    r.push(alphabet[Math.floor(Math.random()*alphabet.length)])
  }
  return r.join('')
}

for (let i = 0; i < 100; i++) {
  const str = randomString(i, 'abcde \n')
  const repl = randomString(Math.random() * i, 'xyz \n')
  const a = Math.floor(Math.random() * i)
  const b = Math.floor(Math.random() * (i + 1))
  const [start, stop] = [a, b].sort((x, y) => x - y)
  //console.group('test input')
  //console.log([str])
  //console.log([repl])
  //console.log(start, stop)
  //console.groupEnd()
  const new_spans = modify(identity_spans(str), start, stop, repl)
  const new_text = new_spans.map(s => s.text).join('')
  const target = str.slice(0, start) + repl + str.slice(stop) + ' '
  //console.log('target', [target])
  //console.log('new_text', [new_text])
  if (target != new_text) {
    throw new Error('Test case failed: ' + target + ' != ' + new_text)
  }
}

