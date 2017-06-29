import * as CodeMirror from "codemirror";

console.log('Reload')

export interface SpanData {
  readonly links: number[],
  readonly labels: string[],
}

export function merge_data(spans: Span[]): SpanData {
  return {
    links: flatten(spans.map(s => s.data.links)),
    labels: flatten(spans.map(s => s.data.labels)),
  }
}

export interface Span {
  readonly text: string,
  readonly data: SpanData,
}

export function identity_spans(original: string): Span[] {
  const segments = (original + ' ').match(/\S*\s+/g) || []
  return segments.map((s, i) => ({
    text: s,
    data: {
      links: [i],
      labels: []
    }
  }))
}

export function check_invariant(spans: Span[]): void {
  const texts = spans.map(s => s.text)
  for (let i = 0; i < spans.length; i++) {
    const text = spans[i].text
    if (!text.match(/^\S(.|\n)*\s$/)) {
      if (i == 0 && text.match(/\s$/)) {
        // ok: first token does not need to start on a word,
        // but cannot be empty
      } else {
        throw new Error('Invariant violated on span ' + i + ' ' + text)
      }
    }
  }
  for (let i = 0; i < spans.length; i++) {
    for (let j = 0; j < spans.length; j++) {
      if (spans[i].data.links.some((x) => spans[j].data.links.some((y) => x == y)) && i != j) {
        throw new Error('Links not injective on indicies ' + i + ' and ' + j)
      }
    }
  }
}

function flatten<A>(xss: A[][]): A[] {
  return ([] as any).concat(...xss)
}

// for slicing and rearranging arrays. to is exclusive
function splitAt<A>(xs: A[], from: number, to: number=from+1): [A[], A[], A[]] {
  return [xs.slice(0, from), xs.slice(from, to), xs.slice(to)]
}

function swap_slices<A>(xs: A[], from1: number, to1: number, from2: number, to2: number): A[] {
  if (from2 < from1) {
    return swap_slices(xs, from2, to2, from1, to1)
  } else if (from2 < to1 || to2 < to1) {
    console.log('one is contained in the other: cannot do anything')
    return xs // one is contained in the other: cannot do anything
  } else {
    const [before2, seg2, after2] = splitAt(xs, from2, to2)
    const [before1, seg1, between] = splitAt(before2, from1, to1)
    return flatten([before1, seg2, between, seg1, after2])
  }
}

// index-based, use CodeMirror's doc.posFromIndex and doc.indexFromPos to convert
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

// Changes the spans with a cursor that can modify a window of width 1 (in reverse)
// return null for no change
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

// this breaks one span if it matches exactly to the original
export function auto_revert(spans: Span[], original: string[]): Span[] {
  return cursor<Span>((prev, me, next) => {
    if (me.text == me.data.links.map((i) => original[i]).join('')) {
      const reverted_spans: Span[] = me.data.links.map((i) => ({
        text: original[i],
        data: {
          links: [i],
          labels: []
        }
      }))
      return [prev].concat(reverted_spans, [next])
    } else {
      return null
    }
  })(spans)
}


// shuffles initial whitespace from a token to the previous one
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

// remove empty spans
const remove_empty: (spans: Span[]) => Span[] =
  cursor<Span>((prev, me, next) => {
    if (me.text.length == 0) {
      //console.debug('Removing span with data:', me.data)
      return [prev, next]
    } else {
      return null // no change
    }
  })

// merge tokens which have no final whitespace with next token
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
  check_invariant(new_spans)
  return new_spans
}

export function span_offset(spans: Span[], index: number): number {
  return spans.slice(0, index).reduce((x, s: Span) => x + s.text.length, 0)
}

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

export function spans_with_offsets(spans: Span[]): [Span, number][] {
  const out: [Span, number][] = []
  let passed = 0
  for (let i = 0; i < spans.length; i++) {
    out.push([spans[i], passed])
    const w = spans[i].text.length
    passed += w
  }
  return out
}




// properties?

const example_text2 = `En dag jag vaknade @@@ när larmet på min telefon ringde. De väder var inte fint.
Det var mycket kult ute med regn. Jag bara dricker te med två broad.

Min bussen går åtta i sju. Jag se min bus när jag borjade springer snabbt som bussen går. Jag var trott
som jag springed så mycket. Han är inte trevlig för mig efter jag missade @@@ bus.`

const example_text = `En dag jag vaknade @@@ när larmet på min telefon ringde. De väder var inte fint.`

const cm_orig = CodeMirror(document.body, {
  value: example_text,
  readOnly: true
})

const cm = CodeMirror(document.body, {
  value: example_text,
  extraKeys: {
    "Ctrl-Z": undo,
    "Ctrl-Y": redo
  }
});

cm.focus()

const cm_diff = CodeMirror(document.body, {
  value: example_text,
  readOnly: true
})

// how should word movement be shown here? Check monotonicity? Maybe that can help in reverting too
function draw_diff() {
  cm_diff.getDoc().getAllMarks().map((m) => m.clear())
  cm_diff.setValue(example_text)
  const rev_links: Map<number, Span | null> = new Map();
  for (const span of cm_spans) {
    let maxlink = -1
    for (const link of span.data.links) {
      maxlink = Math.max(link, maxlink)
      rev_links.set(link, null)
    }
    if (maxlink != -1) {
      rev_links.set(maxlink, span)
    }
  }
  const q: {offset: number, width: number, replace: string}[] = []
  let p: number = 0
  let i: number = 0
  for (const w of orig_text) {
    let replace = ""
    const span = rev_links.get(i)
    if (span) {
      replace = span.text
    }
    if (replace != w) {
      replace = replace.slice(0, whitespace_start(replace))
      q.push({
        offset: p,
        width: whitespace_start(w),
        replace
      })
    }
    i += 1;
    p += w.length;
  }
  q.sort((a, b) => b.offset - a.offset)
  for (const {offset, width, replace} of q) {
    const conv = (off: number) => cm_diff.getDoc().posFromIndex(off)
    if (replace) {
      cm_diff.getDoc().replaceRange(replace, conv(offset+width))
      cm_diff.getDoc().markText(conv(offset+width), conv(offset+width+replace.length), {
        css: 'color: #090'
      })
    }
    cm_diff.getDoc().markText(conv(offset), conv(offset+width), {
      css: 'color: #d00; text-decoration: line-through;'
    })
  }
}

let cm_spans = identity_spans(example_text)
console.log(cm_spans.map(({text}) => text))
const orig_text: string[] = cm_spans.map(x => x.text)
let hist: {past: Span[][], future: Span[][]} = {
  past: [],
  future: []
}
function set_cm_spans(new_cm_spans : Span[]) {
  check_invariant(new_cm_spans)
  hist = {
    past: hist.past.concat([cm_spans]),
    future: []
  }
  cm_spans = new_cm_spans
}
function undo() {
  const new_cm_spans = hist.past.pop()
  if (new_cm_spans) {
    hist.future = hist.future.concat([cm_spans])
    cm_spans = new_cm_spans
    update_from_cm_spans()
  }
}
function redo() {
  const new_cm_spans = hist.future.pop()
  if (new_cm_spans) {
    hist.past = hist.past.concat([cm_spans])
    cm_spans = new_cm_spans
    update_from_cm_spans()
  }
}


/*
for (const t of ["change", "changes", "beforeChange", "cursorActivity", "update", "mousedown", "dblclick", "touchstart", "contextmenu", "keydown", "keypress", "keyup", "cut", "copy", "paste", "dragstart", "dragenter", "dragover", "dragleave", "drop"]) {
  cm.on(t, (_cm: CodeMirror.Editor, ...args: any[]) => console.log(t, ...args))
}
*/

// disable a bunch of "complicated" events for now
for (const t of ["copy", "dragenter"]) {
  (cm.on as any)(t, (_cm: CodeMirror.Editor, evt: Event) => {
    console.log('Preventing', evt)
    evt.preventDefault()
  })
}

(cm.on as any)('cut', (_cm: CodeMirror.Editor, evt: Event) => {
  console.log('cut', evt)
  evt.preventDefault()
  cut()
});

(cm.on as any)('dragstart', (_cm: CodeMirror.Editor, evt: Event) => {
  console.log('cut dragstart', evt)
  // no prevent default
  cut()
});

function cut() {
  const sels = cm.getDoc().listSelections()
  if (sels) {
    const {anchor, head} = sels[0]
    const a = cm.getDoc().indexFromPos(anchor)
    const b = cm.getDoc().indexFromPos(head)
    const from = span_from_offset(cm_spans, Math.min(a, b))[0]
    const to = span_from_offset(cm_spans, Math.max(a, b))[0]
    const conv = (off: number) => cm.getDoc().posFromIndex(off)
    cm.getDoc().getAllMarks().map((m) => m.clear())
    cm.getDoc().markText(conv(span_offset(cm_spans, from)), conv(span_offset(cm_spans, to) + whitespace_start(cm_spans[to].text)), {
      css: 'border-bottom: 1px dotted #aaa; border-top: 1px dotted #aaa; background: #ddd'
    })
  }
}

(cm.on as any)('paste', (_cm: CodeMirror.Editor, evt: Event) => {
  console.log('paste', evt)
  evt.preventDefault()
  paste()
})

function paste() {
  cm.getDoc().getAllMarks().map((m) => {
    const mark = m.find()
    const span_from_pos = (pos: CodeMirror.Position) => span_from_offset(cm_spans, cm.getDoc().indexFromPos(pos))[0]
    const from = span_from_pos(mark.from as any)
    const to = span_from_pos(mark.to as any)
    const cursor = cm.getDoc().getCursor()
    let here = span_from_pos(cursor)
    if (here > to) {
      here++
    }
    console.log(from, to, here)
    console.log(cm_spans.map(({text}) => text))
    set_cm_spans(swap_slices(cm_spans, from, to + 1, here, here))
    update_from_cm_spans()
  })
}

function update_from_cm_spans() {
  console.log(cm_spans.map(({text}) => text))
  const cursor = cm.getDoc().getCursor()
  const upd = cm_spans.map(s => s.text).join('')
  cm.getDoc().setValue(upd.slice(0, upd.length - 1))
  cm.getDoc().setSelection(cursor, cursor)
}

cm.on('cursorActivity', (_: CodeMirror.Editor) => {
  const cursor = cm.getDoc().getCursor()
  const index = cm.getDoc().indexFromPos(cursor)
  const [span, i] = span_from_offset(cm_spans, cm.getDoc().indexFromPos(cursor));
  //console.log(cursor, index, span, i, cm_spans[span], cm_spans[span].data.links)
  cm_orig.getDoc().getAllMarks().map((m) => m.clear())
  for (const linked of cm_spans[span].data.links) {
    // todo: refactor ;)
    const start = orig_text.slice(0, linked).reduce((n, s) => n + s.length, 0)
    const linked_text = orig_text[linked]
    const stop = start + linked_text.length
    const conv = (off: number) => cm_orig.getDoc().posFromIndex(off)
    cm_orig.getDoc().markText(conv(start), conv(stop), {
      css: 'color: #33f'
    })
  }
})

function whitespace_start(s: string): number {
  const m = s.match(/\s*$/)
  if (m) {
    return m.index || s.length
  } else {
    return s.length
  }
}

cm.on('beforeChange', (_, change) => {
  // need to do this /beforeChange/ (not after),
  // otherwise indexFromPos does not work anymore
  // since the position might be removed
  console.log('beforeChange', change.origin, change)

  if (change.origin == 'undo') {
    console.log('undo')
    // we will do our undos ourselves
    change.cancel();
    undo();
  } else if (change.origin == 'redo') {
    console.log('redo')
    // we will do our undos ourselves
    change.cancel();
    redo();
  } else if (change.origin == 'drag') {
    change.cancel()
  } else if (change.origin == 'paste') {
    // drag-and-drop makes this paste:
    change.cancel()
    paste()
  } else if (change.origin != 'setValue') {
    const from = cm.getDoc().indexFromPos(change.from)
    const to = cm.getDoc().indexFromPos(change.to)
    set_cm_spans(auto_revert(modify(cm_spans, from, to, change.text.join('\n')), orig_text))
    console.log(cm_spans.map(({text}) => text))
  }

  draw_diff()
})

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

export function dummy_span(text: string) {
  return {text, data: {links: [], labels: []}}
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
