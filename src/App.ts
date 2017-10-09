/*

Right now we use the cut word part of the CM state using a CM mark

*/
import * as CodeMirror from "codemirror"
import * as typestyle from "typestyle"
import * as Utils from "./Utils"
import * as ViewDiff from "./ViewDiff"
import * as AppTypes from "./AppTypes"
import * as View from "./View"
import * as Spans from "./Spans"

import { Span } from "./Spans"
import { log, debug, debug_table } from "./dev"
import { AppState, EditorState } from "./AppTypes"

// no @types for prettify-xml
declare function require(module_name: string): any
const format: (xml_string: string) => string = require('prettify-xml')

function whitespace_start(s: string): number {
  const m = s.match(/\s*$/)
  if (m) {
    return m.index || s.length
  } else {
    return s.length
  }
}

export function CM(opts: CodeMirror.EditorConfiguration): CodeMirror.Editor {
  const div = document.createElement('div')
  return CodeMirror(div, {lineWrapping: true, ...opts})
}

export function bind(root_element: HTMLElement, init_state: AppState): () => AppState{

  let state = init_state

  function set_state(new_state: AppState) {
    state = new_state
    partial_update_view()
  }

  function mod_state(f: (state: AppState) => AppState) {
    set_state(f(state))
  }

  function set_spans(new_spans : Span[], new_tokens: string[] = []) {
    //log(JSON.stringify({spans, tokens}))
    if (new_spans.length == 0) {
      log('not updating to empty spans')
      // full_view_update will be run on('change')
      return
    }
    if (debug) {
      const errors = Spans.check_invariant(new_spans)
      if (errors.length > 0) {
        console.error(new_spans)
        console.error(errors)
        throw errors
      }
    }
    const spans = new_spans
    const tokens = new_tokens.length > 0 ? new_tokens : state.editor_state.now.tokens
    mod_state(
      AppTypes.on_editor_state(
        (editor_state: AppTypes.Undoable<EditorState>) =>
          AppTypes.advance(
            editor_state,
            {spans, tokens}
      )))
    //debug_state()
  }

  ; (window as any).set_state = (spans: Span[], tokens: string[]) => { set_spans(spans, tokens); full_view_update() }
  ; (window as any).get_state = () => (state.editor_state.now)
  //const debug_state = () => debug_table(spans.map(({...s}) => ({...s, original: s.links.map(i => tokens[i]) })))
  //; (window as any).debug_state = debug_state
  ; (window as any).invert = () => {
    const {spans, tokens} = state.editor_state.now
    const res = Spans.invert(spans, tokens)
    set_spans(res.spans, res.tokens)
    full_view_update()
  }

  const undo = () => { mod_state(AppTypes.on_editor_state(AppTypes.undo)); full_view_update() }
  const redo = () => { mod_state(AppTypes.on_editor_state(AppTypes.redo)); full_view_update() }

  const history_keys = {
    "Ctrl-Z": undo,
    "Ctrl-Y": redo,
    "Ctrl-R": revert,
    "Alt-L": label
  }
  console.log('debug', debug)

  // only create CMs here, move wrapping business to someone else to deal with
  const cm_orig = CM({readOnly: true})
  const cm_main = CM({extraKeys: history_keys})
  const cm_diff = CM({readOnly: true})
  const cm_xml = CM({lineWrapping: false, mode: 'xml', extraKeys: history_keys})

  const patch = View.setup(root_element)

  /** Updates all views, run this when the state is completely new */
  function full_view_update() {
    const {spans, tokens} = state.editor_state.now
    const cursor = cm_main.getDoc().getCursor()
    const upd = spans.map(s => s.text).join('')
    cm_orig.getDoc().setValue(tokens.join(''))
    cm_main.getDoc().setValue(upd.slice(0, upd.length - 1))
    cm_main.getDoc().setSelection(cursor, cursor)
    partial_update_view()
  }

  /** Updates all views but cm_main */
  function partial_update_view() {
    const {spans, tokens} = state.editor_state.now
    const diff = Spans.calculate_diff(spans, tokens)
    const rich_diff = Spans.enrichen_diff(diff)
    const semi_rich_diff = Spans.semirich(rich_diff)
    //debug_table(semi_rich_diff)
    ViewDiff.draw_diff(semi_rich_diff, cm_diff)
    typestyle.forceRenderStyles()

    patch({
      semi_rich_diff,
      cm_orig, cm_main, cm_diff, cm_xml,
      state, set_state,
    })

    const pretty_xml = format(new XMLSerializer().serializeToString(Spans.diff_to_xml(diff)))
    if (pretty_xml != cm_xml.getDoc().getValue()) {
      const cursor = cm_xml.getDoc().getCursor()
      cm_xml.getDoc().setValue(pretty_xml)
      cm_xml.getDoc().setSelection(cursor, cursor)
    }
  }

  cm_main.focus()
  full_view_update()

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

  function revert() {
    const {spans, tokens} = state.editor_state.now
    const sels = cm_main.getDoc().listSelections()
    if (sels) {
      const {head} = sels[0]
      const index = Spans.span_from_offset(spans, cm_main.getDoc().indexFromPos(head))[0]
      set_spans(Spans.revert(index, spans, tokens))
      full_view_update()
    }
  }

  function label() {
    const {spans, tokens} = state.editor_state.now
    const sels = cm_main.getDoc().listSelections()
    if (sels) {
      const {head} = sels[0]
      const index = Spans.span_from_offset(spans, cm_main.getDoc().indexFromPos(head))[0]
      const [pre, [me], post] = Utils.splitAt3(spans, index, index+1)
      set_spans([...pre, {...me, labels: [...me.labels, "ABCXYZ"[Math.floor(Math.random()*6)]]}, ...post])
      full_view_update()
    }
  }

  function cut() {
    const sels = cm_main.getDoc().listSelections()
    if (sels) {
      const {spans, tokens} = state.editor_state.now
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
      const {spans, tokens} = state.editor_state.now
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
      full_view_update()
    })
  }

  // invariant check
  cm_main.on('update', () => {
    const {spans, tokens} = state.editor_state.now
    const lhs = spans.map(s => s.text).join('')
    const rhs = cm_main.getDoc().getValue() + ' '
    //log('update', Utils.show({lhs, rhs}))
    if (rhs != lhs && (Utils.ltrim(rhs) == lhs || Utils.ltrim(rhs) == '')) {
      // everything deleted! just update view
      cm_main.getDoc().setValue(lhs.slice(0, lhs.length - 1))
      full_view_update()
    } else if (lhs != rhs) {
      log("Editor and internal state out of sync:", {lhs, rhs})
    }
  })

  cm_xml.on('beforeChange', (_, change) => {
    const {origin} = change
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
        log('xml change', origin)
        //debug_table(diff)
        //debug_table(res.spans)
        const check = Spans.check_invariant(res.spans)
        if (check != '') {
          console.error(check)
        } else {
          set_spans(res.spans, res.tokens)
          full_view_update()
        }
      } catch (e) {
        console.error(e)
      }
    }
  })

  cm_main.on('beforeChange', (_, change) => {
    // need to do this /beforeChange/ (not after),
    // otherwise indexFromPos does not work anymore
    // since the position might be removed
    //log('beforeChange', change.origin, change)

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
      const {spans, tokens} = state.editor_state.now
      set_spans(
        Spans.chop_up_insertions(
          Spans.auto_revert(
            Spans.modify(spans, from, to, change.text.join('\n')),
            tokens),
          tokens))
      partial_update_view()
      //log(spans.map(({text}) => text))
    }
  })

  return () => state
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

  /*

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

  */


