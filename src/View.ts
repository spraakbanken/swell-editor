/*

Right now we use the cut word part of the CM state using a CM mark

*/
import * as CodeMirror from "codemirror"
import { Editor } from "codemirror"
import * as Spans from "./Spans"
import * as Utils from "./Utils"
import { Span } from "./Spans"
import * as ViewDiff from "./ViewDiff"
import { log, debug } from "./dev"
import * as Positions from "./Positions"

import * as snabbdom from "snabbdom"
import snabbdomClass from 'snabbdom/modules/class'
import snabbdomStyle from 'snabbdom/modules/style'
import snabbdomAttributes from 'snabbdom/modules/attributes'

// no @types for prettify-xml
declare function require(module_name: string): any
const format: (xml_string: string) => string = require('prettify-xml')

interface Editors {
  readonly cm_orig: Editor,
  readonly cm_main: Editor,
  readonly cm_diff: Editor
}

interface State {
  readonly spans: Spans.Span[],
  readonly tokens: string[]
}

interface UndoableState {
  readonly past: State[],
  readonly now: State,
  readonly future: State[]
}

function whitespace_start(s: string): number {
  const m = s.match(/\s*$/)
  if (m) {
    return m.index || s.length
  } else {
    return s.length
  }
}

export function init_data(original: string): UndoableState {
  const tokens = Spans.tokenize(original)
  const spans = Spans.init(tokens)
  return {now: {tokens, spans}, past: [] as State[], future: [] as State[]}
}

export function bind(element: HTMLElement, state: UndoableState): () => UndoableState {
  while (element.lastChild && element.removeChild(element.lastChild)) {}
  const history_keys = {
    "Ctrl-Z": undo,
    "Ctrl-Y": redo
  }
  console.log('debug', debug)

  const cm_orig = CodeMirror(element, { lineWrapping: true, readOnly: true })
  const cm_main = CodeMirror(element, { lineWrapping: true, extraKeys: history_keys })
  const cm_diff = CodeMirror(element, { lineWrapping: true, readOnly: true })

  const patch = snabbdom.init([snabbdomClass, snabbdomStyle, snabbdomAttributes])
  const container = document.createElement('div')
  element.appendChild(container)
  let vnode = patch(container, snabbdom.h('div'))
  let pos_dict = Positions.init_pos_dict()

  const cm_xml = CodeMirror(element, { lineWrapping: false, mode: 'xml', extraKeys: history_keys })
  cm_xml.getWrapperElement().className += ' xml_editor'

  let spans = state.now.spans
  let tokens = state.now.tokens
  let past = state.past.slice()
  let future = state.future.slice()

  /** Updates all views, run this when the state is completely new */
  function update_view() {
    log(spans.map(({text}) => text))
    const cursor = cm_main.getDoc().getCursor()
    const upd = spans.map(s => s.text).join('')
    cm_orig.getDoc().setValue(tokens.join(''))
    cm_main.getDoc().setValue(upd.slice(0, upd.length - 1))
    log('cm_main value:', cm_main.getDoc().getValue())
    cm_main.getDoc().setSelection(cursor, cursor)
    partial_update_view()
  }

  /** Updates all views but cm_main */
  function partial_update_view() {
    const diff = Spans.calculate_diff(spans, tokens)
    ViewDiff.draw_diff(diff, cm_diff)
    do {
      pos_dict.modified = false
      const ladder = ViewDiff.ladder_diff(diff, pos_dict)
      vnode = patch(vnode, ladder)
    } while (pos_dict.modified)
    const pretty_xml = format(new XMLSerializer().serializeToString(Spans.diff_to_xml(diff)))
    if (pretty_xml != cm_xml.getDoc().getValue()) {
      const cursor = cm_xml.getDoc().getCursor()
      cm_xml.getDoc().setValue(pretty_xml)
      cm_xml.getDoc().setSelection(cursor, cursor)
    }
    //log(Utils.show(spans))
  }

  cm_main.focus()
  update_view()

  function set_spans(new_spans : Span[], new_tokens?: string[]) {
    log('set_spans', new_spans)
    if (new_spans.length == 0) {
      log('not updating to empty spans')
      // update_view will be run on('change')
      return
    }
    if (debug) {
      Spans.check_invariant(new_spans)
    }
    past = past.concat([{spans, tokens}])
    spans = new_spans
    tokens = new_tokens || tokens
    future = [] as State[]
  }
  function undo() {
    const new_state = past.pop()
    if (new_state) {
      spans = new_state.spans
      tokens = new_state.tokens
      future = future.concat([new_state])
      update_view()
    }
  }
  function redo() {
    const new_state = future.pop()
    if (new_state) {
      past = past.concat([new_state])
      spans = new_state.spans
      tokens = new_state.tokens
      update_view()
    }
  }

  // disable a bunch of "complicated" events for now
  for (const t of ["copy", "dragenter"]) {
    (cm_main.on as any)(t, (_cm_main: CodeMirror.Editor, evt: Event) => {
      log('Preventing', evt)
      evt.preventDefault()
    })
  }

  (cm_main.on as any)('cut', (_cm_main: CodeMirror.Editor, evt: Event) => {
    log('cut', evt)
    evt.preventDefault()
    cut()
  });

  (cm_main.on as any)('dragstart', (_cm_main: CodeMirror.Editor, evt: Event) => {
    log('cut dragstart', evt)
    // no prevent default
    cut()
  });

  function cut() {
    const sels = cm_main.getDoc().listSelections()
    if (sels) {
      const {anchor, head} = sels[0]
      const a = cm_main.getDoc().indexFromPos(anchor)
      const b = cm_main.getDoc().indexFromPos(head)
      const from = Spans.span_from_offset(spans, Math.min(a, b))[0]
      const to = Spans.span_from_offset(spans, Math.max(a, b))[0]
      const conv = (off: number) => cm_main.getDoc().posFromIndex(off)
      remove_marks_by_class(cm_main, 'cut')
      cm_main.getDoc().markText(
        conv(Spans.span_offset(spans, from)),
        conv(Spans.span_offset(spans, to) + whitespace_start(spans[to].text)), {
          className: 'cut'
        })
    }
  }

  (cm_main.on as any)('paste', (_cm_main: CodeMirror.Editor, evt: Event) => {
    log('paste', evt)
    evt.preventDefault()
    paste()
  })

  function paste() {
    cm_main.getDoc().getAllMarks().map((m) => {
      const mark = m.find()
      const span_from_pos = (pos: CodeMirror.Position) => Spans.span_from_offset(spans, cm_main.getDoc().indexFromPos(pos))[0]
      const from = span_from_pos(mark.from as any)
      const to = span_from_pos(mark.to as any)
      const cursor = cm_main.getDoc().getCursor()
      let here = span_from_pos(cursor)
      if (here > to) {
        here++
      }
      log(from, to, here)
      log(spans.map(({text}) => text))
      set_spans(Spans.rearrange(spans, from, to, here))
      update_view()
    })
  }

  // Highlights the selected token in the orig view
  // FIXME: This crashes if the span cannot be found (can happen when the xml is edited)
  cm_main.on('cursorActivity', (_: CodeMirror.Editor) => {
    const cursor = cm_main.getDoc().getCursor()
    const index = cm_main.getDoc().indexFromPos(cursor)
    const [span, i] = Spans.span_from_offset(spans, cm_main.getDoc().indexFromPos(cursor));
    //log(cursor, index, span, i, spans[span], spans[span].data.links)
    remove_marks_by_class(cm_orig, 'CursorMatch')
    for (const linked of spans[span].links) {
      // todo: refactor ;)
      const start = tokens.slice(0, linked).reduce((n, s) => n + s.length, 0)
      const linked_text = tokens[linked]
      const stop = start + linked_text.length
      const conv = (off: number) => cm_orig.getDoc().posFromIndex(off)
      cm_orig.getDoc().markText(conv(start), conv(stop), {
        className: 'CursorMatch'
      })
    }
  })

  // invariant check
  cm_main.on('update', () => {
    const lhs = spans.map(s => s.text).join('')
    const rhs = cm_main.getDoc().getValue() + ' '
    log('update', Utils.show({lhs, rhs}))
    if (rhs != lhs && (Utils.ltrim(rhs) == lhs || Utils.ltrim(rhs) == '')) {
      // everything deleted! just update view
      cm_main.getDoc().setValue(lhs.slice(0, lhs.length - 1))
      update_view()
    } else if (lhs != rhs) {
      log("Editor and internal state out of sync:", {lhs, rhs})
    }
  })

  cm_xml.on('beforeChange', (_, change) => {
    const {origin} = change
    console.log('beforeChange', change, origin)
    if (origin == 'undo') {
      change.cancel()
      undo()
    } else if (origin == 'redo') {
      change.cancel()
      redo()
    }
  })

  cm_xml.on('change', (_, {origin}) => {
    if (origin != 'setValue') {
      try {
        const diff = Spans.xml_to_diff(cm_xml.getDoc().getValue())
        const res = Spans.diff_to_spans(diff)
        log('xml change to', res, 'origin:', origin)
        const check = Spans.check_invariant(res.spans)
        if (check != '') {
          throw check
        } else {
          set_spans(res.spans, res.tokens)
          update_view()
        }
      } catch (e) {
        console.log(e)
      }
    }
  })

  cm_main.on('beforeChange', (_, change) => {
    // need to do this /beforeChange/ (not after),
    // otherwise indexFromPos does not work anymore
    // since the position might be removed
    log('beforeChange', change.origin, change)

    if (change.origin == 'undo') {
      log('undo')
      // we will do our undos ourselves
      change.cancel();
      undo();
    } else if (change.origin == 'redo') {
      log('redo')
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
      const from = cm_main.getDoc().indexFromPos(change.from)
      const to = cm_main.getDoc().indexFromPos(change.to)
      set_spans(
        Spans.chop_up_insertions(
          Spans.auto_revert(
            Spans.modify(spans, from, to, change.text.join('\n')),
            tokens),
          tokens))
      partial_update_view()
      log(spans.map(({text}) => text))
    }
  })

  return () => ({
    now: {spans, tokens},
    past: past.slice(),
    future: future.slice()
  })
}

function index_from_offset(xs: string[], offset: number): number | null {
  let p = 0
  for (let i=0; i<xs.length; i++) {
    p += xs[i].length
    if (p > offset) {
      return i
    }
  }
  return null
}

function remove_marks_by_class(editor: CodeMirror.Editor, name: string) {
  editor.getDoc().getAllMarks().map((m) => {
    if ((m as CodeMirror.TextMarkerOptions).className == name) {
      m.clear();
    }
  })
}

/*

// When I hover a word in the source text, the corresponding word is highlighted
// in the target text
cm_orig.getWrapperElement().onmousemove = (e : MouseEvent) => {
  const coord = cm_orig.coordsChar({left: e.pageX, top: e.pageY})
  remove_marks_by_class(cm, 'MouseHoverMatch')
  if (!('outside' in coord as any)) {
    const i = index_from_offset(tokens, cm_orig.getDoc().indexFromPos(coord))
    if (i != null) {
      const p = spans.findIndex(s => s.links.some(j => j == i))
      if (p > -1) {
        const from = cm.getDoc().posFromIndex(Spans.span_offset(spans, p))
        const to = cm.getDoc().posFromIndex(Spans.span_offset(spans, p) + spans[p].text.length)
        cm.getDoc().markText(from, to, { className: 'MouseHoverMatch' })
      }
    }
  }
}

// When I hover a word in the target text, the corresponding words in the source
// text are highlighted
cm.getWrapperElement().onmousemove = (e : MouseEvent) => {
  const coord = cm.coordsChar({left: e.pageX, top: e.pageY})
  remove_marks_by_class(cm_orig, 'MouseHoverMatch')
  if (!('outside' in coord as any)) {
    const [i, _] = Spans.span_from_offset(spans, cm_orig.getDoc().indexFromPos(coord))
    for (const p of spans[i].links) {
      const start = tokens.slice(0,p).join('').length
      const from = cm_orig.getDoc().posFromIndex(start)
      const to = cm_orig.getDoc().posFromIndex(start + tokens[p].length)
      cm_orig.getDoc().markText(from, to, { className: 'MouseHoverMatch' })
    }
  }
}
// TODO: Highlights words to and from the diff as well
// TODO: Fix this to be just one highlight that lits up all different views.
//       (since we'll have many views)

*/


/*
for (const t of ["change", "changes", "beforeChange", "cursorActivity", "update", "mousedown", "dblclick", "touchstart", "contextmenu", "keydown", "keypress", "keyup", "cut", "copy", "paste", "dragstart", "dragenter", "dragover", "dragleave", "drop"]) {
  cm.on(t, (_cm: CodeMirror.Editor, ...args: any[]) => log(t, ...args))
}
*/

