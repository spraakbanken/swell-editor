/*

Right now we use the cut word part of the CM state using a CM mark

*/
import * as CodeMirror from "codemirror"
import * as typestyle from "typestyle"
import * as Utils from "./Utils"
import * as ViewDiff from "./ViewDiff"
import * as View from "./View"
import * as Spans from "./Spans"

import * as Snabbdom from "./Snabbdom"
import { CM } from "./Snabbdom"

import { span, div, InputField } from "./View"
import { tag, Content as S } from "snabbis"

import * as Model from "./Model"
import { AppState, EditorState } from "./Model"
export { Model }

import { Store, Lens, Undo } from "reactive-lens"

import { Span } from "./Spans"
import { log, debug, debug_table } from "./dev"
import { VNode } from "snabbis"

export function App(store: Store<AppState>) {
  const global = window as any
  global.store = store
  global.reset = (text: string) => store.set(Model.init(text))
  console.log('making new view')
  return {
    view: Viewish(store),
    services: [
      Model.WithoutHistory(store).storage_connect(),
      // store.location_connect(to_hash, from_hash),
      // store.on(x => console.log(JSON.stringify(x, undefined, 2))),
    ]
  }
}

// export function CM(opts: CodeMirror.EditorConfiguration): {cm: CodeMirror.Editor, vn: VNode} {
//   const div = document.createElement('div')
//   return CodeMirror(div, {lineWrapping: true, ...opts})
// }

export function Viewish(store: Store<AppState>): () => VNode {

  const es = store.at('editor_state')
  const es_now = store.at('editor_state').at('now')

  const debug_state = () => {
    const {spans, tokens} = es_now.get()
    debug_table(spans.map(({...s}) => ({...s, original: s.links.map(i => tokens[i]) })))
  }
  ; (window as any).debug_state = debug_state
  ; (window as any).invert = () => {
    const {spans, tokens} = es_now.get()
    const res = Spans.invert(spans, tokens)
    Model.advance_spans(es, res.spans, res.tokens)
    full_view_update()
  }

  const undo = () => { es.modify(Undo.undo); full_view_update() }
  const redo = () => { es.modify(Undo.redo); full_view_update() }

  const history_keys = {
    "Ctrl-Z": undo,
    "Ctrl-Y": redo,
    "Ctrl-R": revert,
    "Alt-L": label
  }
  console.log('debug', debug)

  const {cm: cm_orig, vn: vn_orig} = CM({readOnly: true})
  const {cm: cm_main, vn: vn_main} = CM({extraKeys: history_keys})
  const {cm: cm_diff, vn: vn_diff} = CM({readOnly: true})
  const {cm: cm_xml, vn: vn_xml} = CM({lineWrapping: false, mode: 'xml', extraKeys: history_keys})
  const needs_full_update = store.at('needs_full_update')

  /** Updates all CM views, run this when the state is completely new */
  function full_view_update() {
    const {spans, tokens} = es_now.get()
    const cursor = cm_main.getDoc().getCursor()
    const upd = spans.map(s => s.text).join('')
    cm_orig.getDoc().setValue(tokens.join(''))
    cm_main.getDoc().setValue(upd.slice(0, upd.length - 1))
    cm_main.getDoc().setSelection(cursor, cursor)
    console.log('full_view_update', {spans, tokens}, cm_main.getDoc().getValue())
    // increment timestamp?
    needs_full_update.set(false)
  }

  const with_full_update = (cb: () => void) => store.transaction(() => {
    cb()
    needs_full_update.set(true)
    // full_view_update()
  })

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
    console.log('cut')
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
    const {spans, tokens} = es_now.get()
    const sels = cm_main.getDoc().listSelections()
    if (sels) {
      const {head} = sels[0]
      const index = Spans.span_from_offset(spans, cm_main.getDoc().indexFromPos(head))[0]
      with_full_update(() => {
        Model.advance_spans(es, Spans.revert(index, spans, tokens))
      })
    }
  }

  function label() {
    const {spans, tokens} = es_now.get()
    const sels = cm_main.getDoc().listSelections()
    if (sels) {
      const {head} = sels[0]
      const index = Spans.span_from_offset(spans, cm_main.getDoc().indexFromPos(head))[0]
      const [pre, [me], post] = Utils.splitAt3(spans, index, index+1)
      with_full_update(() => {
        Model.advance_spans(es, [...pre, {...me, labels: [...me.labels, "ABCXYZ"[Math.floor(Math.random()*6)]]}, ...post])
      })
    }
  }

  function cut() {
    const sels = cm_main.getDoc().listSelections()
    if (sels) {
      const {spans, tokens} = es_now.get()
      const {anchor, head} = sels[0]
      const a = cm_main.getDoc().indexFromPos(anchor)
      const b = cm_main.getDoc().indexFromPos(head)
      const from = Spans.span_from_offset(spans, Math.min(a, b))[0]
      const to = Spans.span_from_offset(spans, Math.max(a, b))[0]
      const conv = (off: number) => cm_main.getDoc().posFromIndex(off)
      remove_marks_by_class(cm_main, 'cut')
      console.log({spans, from, to})
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
      const {spans, tokens} = es_now.get()
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
      with_full_update(() => {
        Model.advance_spans(es, Spans.rearrange(spans, from, to, here))
      })
    })
  }

  // invariant check
  cm_main.on('update', () => {
    const {spans, tokens} = es_now.get()
    const lhs = spans.map(s => s.text).join('')
    const rhs = cm_main.getDoc().getValue() + ' '
    //log('update', Utils.show({lhs, rhs}))
    if (rhs != lhs && (Utils.ltrim(rhs) == lhs || Utils.ltrim(rhs) == '')) {
      // everything deleted! just update view
      cm_main.getDoc().setValue(lhs.slice(0, lhs.length - 1))
      needs_full_update.set(true)
    } else if (lhs != rhs) {
      log("Editor and internal state out of sync:", {lhs, rhs})
      log('Doing full update:')
      needs_full_update.set(true)
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
          with_full_update(() => {
            Model.advance_spans(es, res.spans, res.tokens)
          })
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

    // route this through somewhere else?
    // then the

    console.log(change.origin)

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
      const {spans, tokens} = es_now.get()
      store.transaction(() => {
        Model.advance_spans(es, Spans.modify(spans, from, to, change.text.join('\n')))
        Model.modify_spans(es, (spans, tokens) => Spans.chop_up_insertions(false)(spans, tokens).spans)
        Model.modify_spans(es, (spans, tokens) => Spans.chop_up_insertions(true)(spans, tokens).spans)
        Model.modify_spans(es, (spans, tokens) => Spans.auto_revert(spans, tokens).spans)
        needs_full_update.set(false)
      })
      // bug: fix duplicate states next to each other in undo history
      //log(spans.map(({text}) => text))
    }
  })

  needs_full_update.ondiff(v => (console.log({v}), v) && full_view_update())

  const cms = {vn_orig, vn_main, vn_diff, vn_xml}

  return function partial_update_view() {
    return View.view(store, cms)
  }
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

function whitespace_start(s: string): number {
  const m = s.match(/\s*$/)
  if (m) {
    return m.index || s.length
  } else {
    return s.length
  }
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


