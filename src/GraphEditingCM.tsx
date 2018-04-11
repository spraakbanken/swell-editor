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

import {VNode} from './ReactUtils'

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

export interface CMVN {
  node: VNode
  cm: CodeMirror.Editor
}

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

export interface Cursor {
  head: number
  anchor: number
}

export interface State {
  readonly graph: Undo<Graph>
  readonly hover_id?: string
  readonly subspan?: G.Subspan
}

export interface Actions {
  undo(): void
  redo(): void
  set(s: string): void
  onUpdate(k: (s: string) => void): void
}

export function GraphEditingCM(store: Store<State>, side: G.Side): CMVN {
  /* Note that we don't show the last character of the graph in the code mirror.
  It must necessarily be whitespace anyway. */
  const history = store.at('graph')
  const graph = history.at('now')

  function undo() {
    history.modify(Undo.undo)
  }
  function redo() {
    history.modify(Undo.redo)
  }

  const extraKeys = {
    'Ctrl-Z': undo,
    'Ctrl-Y': redo,
    'Cmd-Z': undo,
    'Cmd-Y': redo,
    'Alt-N': transpose(1),
    'Alt-P': transpose(-1),
  }

  const {cm, node} = CM({extraKeys, tabindex: 3})
  defaultTabBehaviour(cm)
  cm.setValue(G.get_side_text(graph.get(), side))

  function transpose(d: number) {
    return () => {
      if (side === 'source') {
        // rearrange always operates on the target text
        return
      }
      const doc = cm.getDoc()
      const h = Index.cursor('head').toToken().index
      const a = Index.cursor('anchor').toToken().index
      if (h != null && a != null) {
        const [begin, end] = Utils.numsort([h, a])
        const g = graph.get()
        const N = g[side].length
        console.log({begin, end, d, N})
        if (Utils.within(0, begin + d, N) && Utils.within(0, end + d, N)) {
          history.modify(Undo.advance_to(G.rearrange(g, begin, end, d > 0 ? end + d : begin + d)))
          // update CM text now to set the selection at the moved word(s)
          graph_to_cm()
          const g2 = graph.get()
          const from = G.get_side_texts(g2, side)
            .slice(0, begin + d)
            .join('').length
          const to =
            G.get_side_texts(g2, side)
              .slice(0, end + d + 1)
              .join('').length - 1
          const doc = cm.getDoc()
          doc.setSelection(doc.posFromIndex(from), doc.posFromIndex(to))
          update_cursor()
        }
      }
    }
  }

  const {Index} = PositionUtils(cm, graph, side)

  cm.on('beforeChange', (_, change) => {
    if (change.origin == 'undo') {
      change.cancel()
      undo()
    } else if (change.origin == 'redo') {
      change.cancel()
      redo()
    }
  })

  function update_cursor() {
    Utils.timeit('update_cursor', () => {
      const g = graph.get()
      const text = G.get_side_text(graph.get(), side)
      const doc = cm.getDoc()
      const head = Index.cursor('head').index
      const anchor = Index.cursor('anchor').index
      head &&
        anchor &&
        Utils.setIfChanged(
          store.at('subspan'),
          G.sentence_subspans_around_positions(graph.get(), [head, anchor])
        )
    })
  }

  cm.on('cursorActivity', _ =>
    store.transaction(() => {
      update_cursor()
      Utils.setIfChanged(store.at('hover_id'), undefined)
    })
  )

  function texts_differ(): undefined | {graph_text: string; editor_text: string} {
    const graph_text = T.text(graph.get()[side]).slice(0, -1)
    const editor_text = cm.getDoc().getValue()
    if (graph_text !== editor_text) {
      return {graph_text, editor_text}
    } else {
      return undefined
    }
  }

  cm.on('change', (_, change) => {
    if (texts_differ()) {
      store.transaction(() => {
        const g = graph.get()
        history.modify(Undo.advance)
        graph.set(G.set_side(g, side, cm.getDoc().getValue() + ' '))
      })
    }
  })

  function graph_to_cm() {
    const t = texts_differ()
    if (t) {
      const {from, to, insert} = Utils.edit_range(t.editor_text, t.graph_text)
      const doc = cm.getDoc()
      cm.operation(() => {
        doc.setSelection(doc.posFromIndex(from), doc.posFromIndex(to))
        doc.replaceSelection(insert)
      })
    }
  }

  cm.getWrapperElement().addEventListener('mousemove', e => {
    const i = Index.fromCoords(e)
    const {edge} = i.toEdge()
    store.transaction(() => {
      Utils.setIfChanged(store.at('hover_id'), edge ? edge.id : undefined)
    })
  })

  function set_marks() {
    Utils.timeit('set_marks', () => {
      cm.operation(() => {
        console.log('Set marks', side)
        const doc = cm.getDoc()
        doc.getAllMarks().map(m => m.clear())
        const g = graph.get()
        const em = G.edge_map(g)
        const hover_id = store.get().hover_id
        let i = 0
        g[side].forEach(tok => {
          const n = tok.text.length
          const e = em.get(tok.id)
          function mark_me(opts: CodeMirror.TextMarkerOptions) {
            const from = doc.posFromIndex(i)
            const to = doc.posFromIndex(i + n - (tok.text.match(/\s$/) || '').length)
            doc.markText(from, to, opts)
          }
          e && e.manual && mark_me({className: ManualMarkClassName})
          if (e) {
            const className = L.hoverClass(hover_id, e.id)
            className && mark_me({className})
          }
          i += n
        })
      })
    })
  }

  store.on(() => {
    graph_to_cm()
    set_marks()
  })

  graph_to_cm()

  return {node, cm}
}

function PositionUtils(cm: CodeMirror.Editor, graph: Store<Graph>, side: G.Side) {
  class Edge {
    constructor(public readonly edge: G.Edge | null) {}
  }

  class Token {
    constructor(public readonly index: number | null, public readonly token: T.Token | null) {}

    toEdge() {
      if (this.token) {
        const g = graph.get()
        const em = G.edge_map(g)
        const edge = em.get(this.token.id)
        if (edge) {
          return new Edge(edge)
        }
      }
      return new Edge(null)
    }
  }

  class Index {
    constructor(public readonly index: number | null) {}

    static cursor(end: 'head' | 'anchor' = 'head'): Index {
      const doc = cm.getDoc()
      const sels = cm.getDoc().listSelections()
      return new Index(sels ? doc.indexFromPos(sels[0][end]) : null)
    }

    static fromCoords(e: {pageX: number; pageY: number}): Index {
      const coord = cm.coordsChar({left: e.pageX, top: e.pageY})
      if (!(('outside' in coord) as any)) {
        const g = graph.get()
        return new Index(cm.getDoc().indexFromPos(coord))
      } else {
        return new Index(null)
      }
    }

    toEdge() {
      return this.toToken().toEdge()
    }

    toToken(): Token {
      if (this.index != null) {
        const g = graph.get()
        const {token} = T.token_at(G.get_side_texts(g, side), this.index)
        if (token in g[side]) {
          return new Token(token, g[side][token])
        }
      }
      return new Token(null, null)
    }
  }
  return {Edge, Token, Index}
}
