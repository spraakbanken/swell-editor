import * as CodeMirror from 'codemirror'
import * as React from 'react'
import {Store, Lens, Undo} from 'reactive-lens'
import * as Utils from './Utils'

import * as D from './Diff'
import {Graph} from './Graph'
import * as G from './Graph'
import * as L from './LadderView'
import * as RD from './RichDiff'
import * as T from './Token'

import {VNode} from './LadderView'

export const ManualMarkClassName = 'ManualMark'
export const HoverClassName = 'Hover'

function Wrap(h: HTMLElement, k: () => void) {
  return (
    <div
      ref={el => {
        if (el) {
          while (el && el.lastChild) {
            el.removeChild(el.lastChild)
          }
          el.appendChild(h)
          k()
        }
      }}
    />
  )
}

type CMVN = {node: VNode; cm: CodeMirror.Editor}

function CM(opts: CodeMirror.EditorConfiguration): CMVN {
  const div = document.createElement('div')
  const cm = CodeMirror(div, {lineWrapping: true, ...opts})
  return {node: Wrap(div, () => cm.refresh()), cm}
}

function defaultTabBehaviour(cm: CodeMirror.Editor) {
  ;(cm.on as any)('keydown', (_: any, e: KeyboardEvent) => {
    if (e.key == 'Tab') {
      ;(e as any).codemirrorIgnore = true
    }
  })
}

export function GraphEditingCM(
  store: Store<Undo<Graph>>,
  hover_store: Store<string | undefined>
): VNode {
  /* Note that we don't show the last character of the graph in the code mirror.
  It must necessarily be whitespace anyway. */
  const graph = store.at('now')

  function undo() {
    store.modify(Undo.undo)
    console.log('undo')
  }
  function redo() {
    store.modify(Undo.redo)
  }

  const extraKeys = {
    'Ctrl-Z': () => undo(),
    'Ctrl-Y': () => redo(),
    'Cmd-Z': () => undo(),
    'Cmd-Y': () => redo(),
    // "Ctrl-X": () => cut(),
    // "Ctrl-V": () => paste(),
    // "Ctrl-R": () => revert(),
    // "Ctrl-C": () => connect(),
    // "Ctrl-D": () => disconnect(),
  }

  const {cm, node} = CM({extraKeys, tabindex: 3})
  defaultTabBehaviour(cm)
  cm.setValue(G.target_text(graph.get()))

  /*
  cm.on('update', () => {
    const g = graph.get()
    const graph_text = G.target_text(g)
    const editor_text = cm.getDoc().getValue() + ' '
    if (Utils.debug()) {
      const inv = G.check_invariant(g)
      if (inv != 'ok') {
        console.error(inv)
      }
    }
    //log('update', Utils.show({lhs, rhs}))
    if (editor_text != graph_text) {
      // everything deleted! just update view ??
      cm.getDoc().setValue(graph_text)

    }
  })
  */

  cm.on('beforeChange', (_, change) => {
    if (change.origin == 'undo') {
      change.cancel()
      undo()
    } else if (change.origin == 'redo') {
      change.cancel()
      redo()
    }
  })

  cm.on('change', (_, change) => {
    /* if (change.origin == 'drag') {
        change.cancel()
      } else if (change.origin == 'paste') {
        // drag-and-drop makes this paste (yes!):
        change.cancel()
        paste()
      } */
    if (change.origin != 'setValue') {
      store.transaction(() => {
        const g = graph.get()
        // coordinates talk about the previous doc so we get it using a undo
        /*
        const previous_doc = cm.getDoc().copy(true)
        previous_doc.undo()
        const from = previous_doc.indexFromPos(change.from)
        const to = previous_doc.indexFromPos(change.to)
        Utils.stdout({
          prev: previous_doc.getValue(),
          now: cm.getDoc().getValue(),
          from, to, removed: change.removed, text: change.text,
        })
        */
        store.modify(Undo.advance)
        graph.set(G.set_target(g, cm.getDoc().getValue() + ' '))
        set_marks()
      })
    }
  })

  function graph_to_cm() {
    const graph_text = G.target_text(graph.get()).slice(0, -1)
    const editor_text = cm.getDoc().getValue()
    if (graph_text !== editor_text) {
      cm.setValue(graph_text)
      set_marks()
    }
  }

  cm.getWrapperElement().addEventListener('mousemove', e => {
    const coord = cm.coordsChar({left: e.pageX, top: e.pageY})
    if (!(('outside' in coord) as any)) {
      const g = graph.get()
      const {token} = T.token_at(G.target_texts(g), cm.getDoc().indexFromPos(coord))
      const hover_id = g.target[token].id
      hover_store.set(hover_id)
    } else {
      hover_store.set(undefined)
    }
  })

  function set_marks() {
    cm.operation(() => {
      const doc = cm.getDoc()
      doc.getAllMarks().map(m => m.clear())
      const g = store.get().now
      const d = G.calculate_raw_diff(g)
      const em = G.edge_map(g)
      const hover_id = hover_store.get()
      let i = 0
      g.target.forEach(tok => {
        const n = tok.text.length
        const e = em.get(tok.id)
        function mark_me(opts: CodeMirror.TextMarkerOptions) {
          const from = doc.posFromIndex(i)
          const to = doc.posFromIndex(i + n - (tok.text.match(/\s$/) || '').length)
          doc.markText(from, to, opts)
        }
        e && e.manual && mark_me({className: ManualMarkClassName})
        hover_id === tok.id && mark_me({className: HoverClassName})
        e && hover_id === e.id && mark_me({className: HoverClassName})
        i += n
      })
    })
  }

  graph.on(graph_to_cm)
  hover_store.on(set_marks)

  graph_to_cm()

  return node
}
