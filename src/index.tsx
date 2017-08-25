/*

Right now we use the cut word part of the CM state using a CM mark

*/
import * as CodeMirror from "codemirror";
import * as Spans from "./Spans"
import { Span } from "./Spans"

console.log('Reload')

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

const tokens = Spans.tokenize(example_text)
let cm_spans = Spans.init(tokens)
let hist: {past: Span[][], future: Span[][]} = {
  past: [],
  future: []
}
function set_cm_spans(new_cm_spans : Span[]) {
  Spans.check_invariant(new_cm_spans)
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

function wsplit(s: string): [string, string] {
  const m = s.match(/^(.*?)(\s*)$/)
  if (m && m.length == 3) {
    return [m[1], m[2]]
  }
  return [s, ''] // unreachable (the regexp matches any string)
}

const draw_diff = () => cm_diff.operation(() => {
  // TODO: Renumber all ids so they are contiguous and monotone
  const diff_doc = cm_diff.getDoc()
  diff_doc.setValue('')
  diff_doc.getAllMarks().map((m) => m.clear())
  function push(text: string, css: string = '') {
    diff_doc.replaceSelection(text)
    if (css) {
      const end = diff_doc.getCursor()
      const begin = diff_doc.posFromIndex(diff_doc.indexFromPos(end) - text.length)
      diff_doc.markText(begin, end, {css: css})
    }
  }
  Spans.calculate_diff(cm_spans, tokens).map((d) => {
    if (d.kind == 'Unchanged') {
      push(d.now)
    } else if (d.kind == 'Edited') {
      const [s, t] = wsplit(d.now)
      push(s, 'color: #090')
      push(d.source.trim(), 'color: #d00; text-decoration: line-through;')
      push(t)
    } else if (d.kind == 'Dropped') {
      const [s, t] = wsplit(d.now)
      push(s, 'background-color: #87ceeb')
      push(d.ids.join(','), 'position: relative; bottom: -0.5em; font-size: 65%')
      if (d.source != d.now) {
        push(d.source.trim(), 'color: #d00; text-decoration: line-through;')
      }
      push(t)
    } else if (d.kind == 'Dragged') {
      const [s, t] = wsplit(d.source)
      push(s, 'background-color: #87ceeb; text-decoration: line-through;')
      push(d.id + '', 'position: relative; bottom: -0.5em; font-size: 65%')
      push(t)
    } else if (d.kind == 'Inserted') {
      const [s, t] = wsplit(d.now)
      push(s, 'color: #090')
      push(t)
    } else if (d.kind == 'Deleted') {
      const [s, t] = wsplit(d.source)
      push(s, 'color: #d00; text-decoration: line-through;')
      push(t)
    } else {
      const d2: never = d
    }
  })
})


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
    const from = Spans.span_from_offset(cm_spans, Math.min(a, b))[0]
    const to = Spans.span_from_offset(cm_spans, Math.max(a, b))[0]
    const conv = (off: number) => cm.getDoc().posFromIndex(off)
    cm.getDoc().getAllMarks().map((m) => m.clear())
    cm.getDoc().markText(conv(Spans.span_offset(cm_spans, from)), conv(Spans.span_offset(cm_spans, to) + whitespace_start(cm_spans[to].text)), {
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
    const span_from_pos = (pos: CodeMirror.Position) => Spans.span_from_offset(cm_spans, cm.getDoc().indexFromPos(pos))[0]
    const from = span_from_pos(mark.from as any)
    const to = span_from_pos(mark.to as any)
    const cursor = cm.getDoc().getCursor()
    let here = span_from_pos(cursor)
    if (here > to) {
      here++
    }
    console.log(from, to, here)
    console.log(cm_spans.map(({text}) => text))
    set_cm_spans(Spans.rearrange(cm_spans, from, to, here))
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
  const [span, i] = Spans.span_from_offset(cm_spans, cm.getDoc().indexFromPos(cursor));
  //console.log(cursor, index, span, i, cm_spans[span], cm_spans[span].data.links)
  cm_orig.getDoc().getAllMarks().map((m) => m.clear())
  for (const linked of cm_spans[span].links) {
    // todo: refactor ;)
    const start = tokens.slice(0, linked).reduce((n, s) => n + s.length, 0)
    const linked_text = tokens[linked]
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
    set_cm_spans(Spans.auto_revert(Spans.modify(cm_spans, from, to, change.text.join('\n')), tokens))
    console.log(cm_spans.map(({text}) => text))
  }

  draw_diff()
})

