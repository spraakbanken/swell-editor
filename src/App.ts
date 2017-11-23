/*

Right now we use the cut word part of the CM state using a CM mark

*/
import * as CodeMirror from "codemirror"
import * as typestyle from "typestyle"

import * as Snabbdom from "./Snabbdom"
import { CM } from "./Snabbdom"

import { C, c } from './Classes'

import { View } from "./View"
import { tag, Content as S } from "snabbis"

import * as Model from "./Model"
import { AppState } from "./Model"
export { Model }
export { Dropdown }

import { log, debug, debug_table } from "./dev"
import { VNode } from "snabbis"

import { Diff, Dragged, Dropped } from './Diff'
import * as D from './Diff'
import { RichDiff } from './RichDiff'
import * as R from './RichDiff'
import { Graph } from "./Graph"
import * as G from "./Graph"
import { Token, Span } from './Token'
import * as T from './Token'
import { TokenDiff } from "./Utils"
import * as Utils from "./Utils"

import { Store, Lens, Undo } from "reactive-lens"

import * as Dropdown from "./Dropdown"

export function App(store: Store<AppState>) {
  {
    const global = window as any
    global.Model = Model
    global.G = G
    global.R = R
    global.D = D
    global.T = T
    global.Utils = Utils
    global.Lens = Lens
    global.Undo = Undo
    global.Store = Store
    global.store = store

    Model.setup_sync(store)
    Dropdown.Handler(store.at('dropdown'))

    const storage_key = 'state'
    Model.ForLocalStorage(store).storage_connect(storage_key, item => item.login_state != 'anonymous')
    global.reset = (text: string) => {
      store.set(Model.init(text))
      localStorage.removeItem(storage_key)
    }
  }

  const needs_full_update = store.at('needs_full_update')
  const with_full_update = (cb: () => void) => store.transaction(() => {
    cb()
    full_view_update()
    // needs_full_update.set(true)
  })

  store.at('current').ondiff(() => needs_full_update.set(true))

  const current = Model.current(store)
  const undo_graph = current.at('graph')
  const graph = undo_graph.at('now')

  const undo = () => { undo_graph.modify(Undo.undo); full_view_update() }
  const redo = () => { undo_graph.modify(Undo.redo); full_view_update() }

  const Request = Model.ActionMaker(store)

  const extraKeys = {
    "Ctrl-X": () => cut(),
    "Ctrl-V": () => paste(),
    "Ctrl-Z": () => Request('undo'),
    "Ctrl-Y": () => Request('redo'),
    "Ctrl-R": () => Request('revert'),
    "Ctrl-C": () => Request('connect'),
    "Ctrl-D": () => Request('disconnect'),
    "Cmd-X": () => cut(),
    "Cmd-V": () => paste(),
    "Cmd-Z": () => Request('undo'),
    "Cmd-Y": () => Request('redo'),
    "Cmd-R": () => Request('revert'),
    "Cmd-C": () => Request('connect'),
    "Cmd-D": () => Request('disconnect'),
  }
  console.log('debug', debug)

  const {cm: cm_main, vn: vn_main} = CM({extraKeys})
  const {cm: cm_orig, vn: vn_orig} = CM({readOnly: store.get().ro_source})
  store.at('ro_source').ondiff(ro => cm_orig.setOption('readOnly', ro))

  cm_orig.on('change', (_, change) => {
    if (change.origin != 'setValue' && !store.get().ro_source) {
      with_full_update(() => {
        current.set(Model.init_graph_state(cm_orig.getDoc().getValue()))
      })
    }
  })

  // const {cm: cm_diff, vn: vn_diff} = CM({readOnly: true})
  // const {cm: cm_xml, vn: vn_xml} = CM({lineWrapping: false, mode: 'xml', extraKeys: history_keys})

  const selected_index = current.at('selected_index')
  const ci = current.at('cursor_index')
  function update_cursor_index() {
    const g = graph.get()
    const text = G.target_text(g)
    const cursor = cm_main.getDoc().getCursor()
    const character_offset = cm_main.getDoc().indexFromPos(cursor)
    try {
      const i = T.token_at(G.target_texts(g), character_offset).token
      if (ci.get() != i) {
        ci.set(i)
      }
    } catch (e) {
      // ok
    }
  }
  cm_main.on('cursorActivity', () => update_cursor_index())

  store.at('requests').ondiff(requests => {
    if (requests.length > 0) {
      store.transaction(() => {
        store.at('requests').set([])
        requests.forEach(r => {
          if (typeof r == 'object') {
            switch (r.kind) {
              case 'revert_at':
                const g = graph.get()
                const e = g.edges[r.at]
                if (e) {
                  with_full_update(() => {
                    Model.advance_graph(undo_graph, G.revert(graph.get(), e.id))
                  })
                }
                return
              case 'disconnect_at':
                with_full_update(() => {
                  Model.advance_graph(undo_graph, G.disconnect(graph.get(), r.at))
                })
                return
              case 'connect_two':
                with_full_update(() => {
                  Model.advance_graph(undo_graph, G.connect(graph.get(), r.one, r.two))
                })
                return
              case 'select_index':
                select_index(r.index)
                return
              default: return Utils.absurd(r)
            }
          } else {
            switch (r) {
              case 'undo': return undo()
              case 'redo': return redo()
              case 'revert': return revert()
              case 'connect': return connect()
              case 'disconnect': return disconnect()
              case 'next': return next()
              case 'prev': return prev()
              default: return Utils.absurd(r)
            }
          }
        })
      })
    }
  })

  function select_index(i: number | null) {
    store.transaction(() => {
      selected_index.set(i)
      console.log('select_index', i)
      if (i != null) {
        const {diff} = Model.calculate_diffs(store.get())
        if (i >= 0 && i < diff.length) {
          store.at('dropdown').update({
            active: G.label_store(current.at('graph').at('now'), diff[i].id),
            cursor: undefined,
            input: ''
          })
        }
      } else {
        store.at('dropdown').update({
          active: undefined,
          cursor: undefined,
          input: ''
        })
      }
    })
  }


  function next() {
    const {diff} = Model.calculate_diffs(store.get())
    const si = selected_index.get()
    if (si != null) {
      const ni = D.next(diff, si)
      ni != null && select_index(ni)
      if (ni == null) {
        const g = graph.get()
        const {end} = G.target_sentence(g, ci.get())
        if (end + 1 < G.target_texts(g).length) {
          ci.set(end + 1)
          select_index(0)
        }
      }
    }
  }

  function prev() {
    const {diff} = Model.calculate_diffs(store.get())
    const si = selected_index.get()
    if (si != null) {
      const pi = D.prev(diff, si)
      pi != null && select_index(pi)
      if (pi == null) {
        const g = graph.get()
        const {begin} = G.target_sentence(g, ci.get())
        if (begin - 1 >= 0) {
          ci.set(begin - 1)
          select_index(Model.calculate_diffs(store.get()).diff.length - 2)
        }
      }
    }
  }

  ci.ondiff(() => {
    const {diff} = Model.calculate_diffs(store.get())
    const si = selected_index.get()
    if (si != null && si >= diff.length) {
      select_index(null)
    }
  })

  /** Updates all CM views, run this when the state is completely new */
  function full_view_update() {
    const g = graph.get()
    const text = G.target_text(g)
    const cursor = cm_main.getDoc().getCursor()
    const orig_cursor = cm_orig.getDoc().getCursor()
    const target_text = G.target_text(g)
    cm_orig.getDoc().setValue(G.source_text(g))
    cm_main.getDoc().setValue(target_text.slice(0, target_text.length - 1)) // minus last token
    cm_main.getDoc().setSelection(cursor, cursor)
    cm_orig.getDoc().setSelection(orig_cursor, orig_cursor)
    cm_main.refresh()
    cm_orig.refresh()
    // increment timestamp?
    needs_full_update.set(false)
  }

  store.at('login_state').ondiff(state => {
    if (state == 'anonymous') {
      if (cm_orig.getDoc().getValue() != Model.example_sentence) {
        with_full_update(() => Model.load_example(undo_graph))
      }
    }
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
    const sels = cm_main.getDoc().listSelections()
    if (sels) {
      const s = sels[0]
      const {Anchor, Head} = selected_target()
      const [from, to] = Utils.numsort([Anchor.token, Head.token])
      const g0 = graph.get()
      const em = G.edge_map(g0)
      with_full_update(() => {
        for (let t = from; t <= to; ++t) {
          const e = em.get(g0.target[t].id)
          if (e) {
            Model.advance_graph(undo_graph, G.revert(graph.get(), e.id))
          }
        }
      })
    }
  }

  function disconnect() {
    const sels = cm_main.getDoc().listSelections()
    if (sels) {
      const {Anchor, Head} = selected_target()
      const t = graph.get().target[Head.token]
      if (t) {
        with_full_update(() => {
          Model.advance_graph(undo_graph, G.disconnect(graph.get(), t.id))
        })
      }
    }
  }

  function connect() {
    const sels = cm_main.getDoc().listSelections()
    if (sels) {
      const s = sels[0]
      const {Anchor, Head} = selected_target()
      const [from, to] = Utils.numsort([Anchor.token, Head.token])
      const t1 = graph.get().target[from]
      const t2 = graph.get().target[to]
      if (t1 && t2) {
        with_full_update(() => {
          for (let t = from + 1; t <= to; ++t) {
            const em =  G.edge_map(graph.get())
            const e1 = em.get(t1.id)
            const e2 = em.get(graph.get().target[t].id)
            if (e1 && e2) {
              Model.advance_graph(undo_graph, G.connect(graph.get(), e1.id, e2.id))
            }
          }
        })
      }
    }
  }

  function selected_target() {
    const sels = cm_main.getDoc().listSelections()
    if (sels) {
      const {anchor, head} = sels[0]
      const target_texts = G.target_texts(graph.get())
      const Anchor = T.token_at(target_texts, cm_main.getDoc().indexFromPos(anchor))
      const Head = T.token_at(target_texts, cm_main.getDoc().indexFromPos(head))
      return {Anchor, Head}
    } else {
      throw 'No selection'
    }
  }

  function cut() {
    const sels = cm_main.getDoc().listSelections()
    if (sels) {
      const {Anchor, Head} = selected_target()
      const [from, to] = Utils.numsort([Anchor.token, Head.token])
      const conv = (off: number) => cm_main.getDoc().posFromIndex(off)
      const target_texts = G.target_texts(graph.get())
      remove_marks_by_class(cm_main, c.Cut)
      log({what: 'cut', from, to})
      cm_main.getDoc().markText(
        conv(T.text_offset(target_texts, from)),
        conv(T.text_offset(target_texts, to) + whitespace_start(target_texts[to])), {
          className: c.Cut
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
      const target_texts = G.target_texts(graph.get())
      const mark = m.find()
      const token_index = (pos: CodeMirror.Position) => T.token_at(target_texts, cm_main.getDoc().indexFromPos(pos)).token
      const from = token_index(mark.from as any)
      const to = token_index(mark.to as any)
      const cursor = cm_main.getDoc().getCursor()
      let here = token_index(cursor)
      log({what: 'paste', from, to, here})
      with_full_update(() => {
        Model.advance_graph(undo_graph, G.rearrange(graph.get(), from, to, here))
      })
    })
  }

  // invariant check
  cm_main.on('update', () => {
    const g = graph.get()
    const lhs = G.target_text(g)
    const rhs = cm_main.getDoc().getValue() + ' '
    if (debug) {
      const inv = G.check_invariant(g)
      if (inv != 'ok') {
        console.error(inv)
      }
    }
    //log('update', Utils.show({lhs, rhs}))
    if (rhs != lhs && (Utils.ltrim(rhs) == lhs || Utils.ltrim(rhs) == '')) {
      // everything deleted! just update view ??
      cm_main.getDoc().setValue(lhs.slice(0, lhs.length - 1))
      needs_full_update.set(true)
    } else if (lhs != rhs) {
      log("Editor and internal state out of sync:", Utils.show({lhs, rhs}))
      log('Doing full update:')
      needs_full_update.set(true)
    }
  })

  cm_main.on('beforeChange', (_, change) => {
    store.transaction(() => {
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
        const g = graph.get()
        const from = cm_main.getDoc().indexFromPos(change.from)
        const to = cm_main.getDoc().indexFromPos(change.to)
        Model.advance_graph(undo_graph, G.modify(g, from, to, change.text.join('\n')))
        // Model.modify_spans(es, (spans, tokens) => Spans.auto_revert(spans, tokens).spans)
        needs_full_update.set(false)
      }
    })
  })

  needs_full_update.ondiff(v => v && full_view_update())

  const cms = {vn_orig, vn_main}

  return {
    view: () => View(store, Model.calculate_diffs(store.get()), cms)
  }
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


