import * as CodeMirror from 'codemirror'
import {Store} from 'reactive-lens'
import * as Utils from '../Utils'

import * as G from '../Graph'
import * as GV from '../GraphView'

import * as ReactUtils from '../ReactUtils'

import * as Model from './Model'

interface cmResize {
  (cm: CodeMirror.Editor, opts?: any): CodeMirror.Editor
}

const cmResize: cmResize = require('cm-resize').default

export const ManualMarkClassName = 'ManualMark'
export const SelectedMarkClassName = 'SelectedMark'
export const HoverClassName = 'Hover'

export interface CMVN {
  node: ReactUtils.VNode
  cm: CodeMirror.Editor
}

function CM(opts: CodeMirror.EditorConfiguration): CMVN {
  const div = document.createElement('div')
  const cm = CodeMirror(div, {lineWrapping: true, ...opts})
  cmResize(cm, {resizableWidth: false, minHeight: 32, cssClass: 'cm-resize-handle'})
  return {node: ReactUtils.Wrap(div, () => cm.refresh()), cm}
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

// Functions for testing whether a given change is allowed.
export type Change =
  | {type: 'editor'; change: CodeMirror.EditorChangeCancellable}
  | {type: 'transpose'}
export type ChangeCheck = (change: Change) => boolean

export function GraphEditingCM(
  store: Store<Model.State>,
  side: G.Side,
  checkChange?: ChangeCheck
): CMVN {
  /* Note that we don't show the last character of the graph in the code mirror.
  It must necessarily be whitespace anyway. */
  const graph = Model.graphStore(store)
  const advance = Model.make_history_advance_function(store)
  const realCheckChange: ChangeCheck = change =>
    !Model.can_modify(store.get()).state ? false : checkChange ? checkChange(change) : true

  const {undo, redo} = Model.history(store)

  const extraKeys = {
    'Ctrl-Z': undo,
    'Ctrl-Y': redo,
    'Cmd-Z': undo,
    'Cmd-Y': redo,
    'Alt-Right': transpose(1),
    'Alt-Left': transpose(-1),
    'Cmd-Right': transpose(1),
    'Cmd-Left': transpose(-1),
  }

  const {cm, node} = CM({extraKeys, tabindex: 3})
  defaultTabBehaviour(cm)

  const {Index} = PositionUtils(cm, store, side)

  function transpose(d: number) {
    return () => {
      if (!realCheckChange({type: 'transpose'})) {
        return
      }
      const h = Index.cursor('head').toToken().index
      const a = Index.cursor('anchor').toToken().index
      if (h != null && a != null) {
        const [begin, end] = Utils.numsort([h, a])
        const g = graph.get()
        const N = g[side].length
        if (Utils.within(0, begin + d, N) && Utils.within(0, end + d, N)) {
          advance(() => graph.set(G.rearrange(g, begin, end, d > 0 ? end + d : begin + d)))
          // update CM text now to set the selection at the moved word(s)
          graph_to_cm()
          const g2 = graph.get()
          // set the selection to the displaced word:
          const from = G.get_side_texts(g2, side)
            .slice(0, begin + d)
            .join('').length
          const to =
            G.get_side_texts(g2, side)
              .slice(0, end + d + 1)
              .join('').length - 1
          const doc = cm.getDoc()
          doc.setSelection(doc.posFromIndex(from), doc.posFromIndex(to))
          cursor_to_viewport()
        }
      }
    }
  }

  cm.on('beforeChange', (editor, change) => {
    if (change.origin == 'undo') {
      change.cancel()
      undo()
    } else if (change.origin == 'redo') {
      change.cancel()
      redo()
    }
    // Why is removed not set? Set it.
    if (change.origin.substr(1) == 'delete') {
      change.removed = editor
        .getDoc()
        .getRange(change.from, change.to)
        .split('\n')
    }
    // Only check manual user-made changes. Programmatic changes should set the origin to @ignore.
    if (change.origin !== '@ignore' && !realCheckChange({type: 'editor', change})) {
      change.cancel()
    }
  })

  cm.on('mousedown', () => Model.deselect(store))

  function cursor_to_viewport() {
    Utils.timeit('cursor_to_viewport', () => {
      const g = graph.get()
      const text = G.get_side_text(graph.get(), side)
      const doc = cm.getDoc()
      const head = Index.cursor('head').index
      const anchor = Index.cursor('anchor').index
      head &&
        anchor &&
        Model.setSubspanIncluding(
          store,
          G.indicies_around_positions(graph.get(), side, [head, anchor])
        )
    })
  }

  cm.on('cursorActivity', _ =>
    store.transaction(() => {
      cursor_to_viewport()
      Utils.setIfChanged(store.at('hover_id'), undefined)
    })
  )

  function do_texts_differ(): undefined | {graph_text: string; editor_text: string} {
    const graph_text = G.get_side_text(Model.viewGraph(store), side).slice(0, -1)
    const editor_text = cm.getDoc().getValue()
    if (graph_text !== editor_text) {
      return {graph_text, editor_text}
    } else {
      return undefined
    }
  }

  cm.on('scrollCursorIntoView' as any, (_, e: {preventDefault(): void}) => {
    //console.log('scroll cursor into view', e)
    e.preventDefault()
  })

  cm.on('change', (_, change) => {
    if (do_texts_differ()) {
      advance(g => {
        graph.set(G.set_side(g, side, cm.getDoc().getValue() + ' '))
      })
    }
  })

  function graph_to_cm() {
    const t = do_texts_differ()
    if (t) {
      const {from, to, insert} = Utils.edit_range(t.editor_text, t.graph_text)
      const doc = cm.getDoc()
      doc.replaceRange(insert, doc.posFromIndex(from), doc.posFromIndex(to), '@ignore')
    }
  }

  cm.getWrapperElement().addEventListener('mousemove', e => {
    const i = Index.fromCoords(e)
    const {edge} = i.toEdge()
    store.transaction(() => {
      Utils.setIfChanged(store.at('hover_id'), edge ? edge.id : undefined)
    })
  })

  cm.getWrapperElement().addEventListener('mouseleave', e => {
    store.at('hover_id').set(undefined)
  })

  function set_marks() {
    Utils.timeit('set_marks', () => {
      cm.operation(() => {
        const doc = cm.getDoc()
        doc.getAllMarks().map(m => m.clear())
        const g = Model.viewGraph(store)
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
          tok.id in store.get().selected && mark_me({className: SelectedMarkClassName})
          if (e) {
            e.manual && mark_me({className: ManualMarkClassName})
            const className = GV.hoverClass(hover_id, e.id)
            className && mark_me({className})
          }
          i += n
        })
      })
    })
  }

  function sync() {
    graph_to_cm()
    set_marks()
  }

  store.on(sync)
  sync()

  store.at('selected').ondiff(selected => {
    scrollTokensIntoView(Object.keys(selected))
  })

  function scrollTokensIntoView(token_ids: string[]) {
    const g = graph.get()
    const tokens = G.partition_ids(g)(token_ids)[side].sort()
    if (!tokens.length) return
    // Turn first and last token indexes to CM positions.
    const [from, to] = Utils.ends(tokens).map(t => {
      const sided_index = G.token_map(g).get(t.id)
      return sided_index ? Index.fromTokenIndex(sided_index.index).toPos() : null
    })
    from && to && cm.scrollIntoView({from, to}, 0)
  }

  return {node, cm}
}

function PositionUtils(cm: CodeMirror.Editor, store: Store<Model.State>, side: G.Side) {
  class Edge {
    constructor(public readonly edge: G.Edge | null) {}
  }

  class Token {
    constructor(public readonly index: number | null, public readonly token: G.Token | null) {}

    toEdge() {
      if (this.token) {
        const g = Model.viewGraph(store)
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
        return new Index(cm.getDoc().indexFromPos(coord))
      } else {
        return new Index(null)
      }
    }

    static fromTokenIndex(tok_i: number): Index {
      const g = Model.viewGraph(store)
      const i = G.get_side_texts(g, side)
        .slice(0, tok_i)
        .join('').length
      return new Index(i)
    }

    toEdge() {
      return this.toToken().toEdge()
    }

    toToken(): Token {
      if (this.index != null) {
        const g = Model.viewGraph(store)
        const {token} = G.token_at(G.get_side_texts(g, side), this.index)
        if (token in g[side]) {
          return new Token(token, g[side][token])
        }
      }
      return new Token(null, null)
    }

    toPos(): CodeMirror.Position | null {
      return this.index ? cm.getDoc().posFromIndex(this.index) : null
    }
  }
  return {Edge, Token, Index}
}
