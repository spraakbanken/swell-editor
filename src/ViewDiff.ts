import { Taxonomy } from "./Model"
import * as Model from "./Model"
import { Token } from "./Token"
import { RichDiff } from './RichDiff'
import * as R from './RichDiff'
import { Graph, Edge } from "./Graph"
import * as G from "./Graph"

import { Store, Lens, Undo } from "reactive-lens"

import { C, c } from './Classes'
import * as csstips from "csstips"
import * as Positions from "./Positions"

import * as Snabbdom from "./Snabbdom"
import { CatchSubmit, InputField, button, div, span, on } from "./Snabbdom"

import { log } from './dev'
import { PosDict } from "./Positions"
import { style } from "typestyle"
import { tag, VNode, Content as S } from "snabbis"

import * as Utils from "./Utils"
import { TokenDiff }  from "./Utils"

export interface ViewDiffState {
  readonly graph: Undo<Graph>,
  readonly positions: PosDict,
  readonly selected_index: number | null,
}

interface Column {
  readonly up: VNode[],
  readonly mid: VNode[],
  readonly down: VNode[],
  readonly ix: number
}

type Link = {
  readonly from: string,
  readonly to: string
}

function Link(from: string, to: string): Link {
  return {from, to}
}

const orange = style({color: 'orange'})
const red = style({
  color: 'red',
})

function LabelEditor(store: Store<string[]>, Request: Model.Action, selected_index: Store<number | null>, taxonomy: Taxonomy): VNode {
  let off = undefined as undefined | (() => void)
  return div(
    S.styles({marginTop: '2px', marginBottom: '4px'}),
    C.BorderCell,
    div(
      S.on('keydown')((e: KeyboardEvent) => {
        if (e.code == 'Tab') {
          Request(e.shiftKey ? 'prev' : 'next')
          e.preventDefault()
        } else if (e.code == 'Escape') {
          Request('unselect')
        }
      }),
      CatchSubmit(
        () => Request('next'),
        InputField(
          Utils.store_join(store).via(Lens.iso(s => s.toUpperCase(), s => s.toUpperCase())),
          S.attrs({autofocus: true}),
          S.hook({
            insert: (vn) => {
              const elt = vn.elm as HTMLInputElement
              elt.focus()
              if (off) { off() }
              off = selected_index.ondiff(() => elt.focus())
            },
            remove: () => off && off()
          })
         )
      ),
    ),
    div(
      S.styles({width: '160px'}),
      C.HSpaced,
      taxonomy.map(t => {
        const tstore = Utils.array_store_key(store, t.code)
        const active = tstore.get()
        return tag('span',
          C.InlineBlock,
          C.Pointer,
          t.code + ' ',
          S.on('click')(() => tstore.modify(x => !x)),
          S.classes({[orange]: tstore.get()}),
        )
      }),
      tag('a', 'info', S.styles({float: 'right'}),
        S.attrs({
          href: 'https://spraakbanken.gu.se/eng/swell/swell_codebook',
          target: '_blank'
        })),
    )
  )
}

export function ViewDiff(store: Store<ViewDiffState>, Request: Model.Action, rich_diff: RichDiff[], taxonomy: Taxonomy): VNode {

  const select_index = (ix: number | null) => S.on('click')(e => {
    // store.at('selected_index').modify(ix_now => ix_now === ix ? null : ix)
    store.at('selected_index').set(ix)
    e.stopPropagation()
  })

  const positions = store.at('positions')
  const track = (id: string, vnode: VNode) => {
    return Positions.posid(id, positions, vnode)
  }
  const links = [] as Link[]
  const columns = [] as Column[]
  let column: Column
  let up: VNode[]
  let mid: VNode[]
  let down: VNode[]
  const new_column = (ix: number) => {
    up = []
    mid = []
    down = []
    column = {up, mid, down, ix}
    columns.push(column)
  }

  const new_source = (s: Token, diff: TokenDiff, edge_id: string) => {
    up.push(track(s.id, span(deletes(diff), C.InnerCell,
      S.attrs({ draggable: 'true' }),
      S.on('dblclick')((e: MouseEvent) => {
        e.preventDefault()
        Request({kind: 'disconnect_at', at: s.id})
      })
    )))
    links.push(Link(s.id, edge_id))
  }
  const new_target = (t: Token, diff: TokenDiff, edge_id: string) => {
    down.push(track(t.id, span(inserts(diff), C.InnerCell,
      S.attrs({ draggable: 'true' }),
      S.on('dblclick')((e: MouseEvent) => {
        e.preventDefault()
        Request({kind: 'disconnect_at', at: t.id})
      })
    )))
    links.push(Link(edge_id, t.id))
  }
  const {selected_index} = store.get()
  const edges_done = new Set<string>()
  const edges = store.get().graph.now.edges
  const new_label = (edge_id: string, diff_index: number) => {
    if (!edges_done.has(edge_id)) {
      edges_done.add(edge_id)
      const vn = div(
        C.Vertical,
        span(
          edges[edge_id].labels.map(
            code => span(
              code + ' ',
              S.classes({
                [red]: diff_index !== selected_index && taxonomy.every(t => t.code != code)
              })
            )
          ),
          C.BorderCell,
          S.styles({height: 'min-content'}),
          S.attrs({ draggable: 'true' }),
          S.classes({[c.LadderSelected]: diff_index === selected_index}),
        )
      )
      mid.push(track(edge_id, vn))
    }
  }

  rich_diff.forEach((d, ix) => {
    new_column(ix)
    switch(d.edit) {
      case 'Edited':
        d.source.map((s, i) => new_source(s, d.source_diffs[i], d.id))
        new_label(d.id, ix)
        d.target.map((t, i) => new_target(t, d.target_diffs[i], d.id))
        return

      case 'Dragged':
        new_source(d.source, d.source_diff, d.id)
        new_label(d.id, ix)
        return

      case 'Dropped':
        new_label(d.id, ix)
        new_target(d.target, d.target_diff, d.id)
        return
    }
  })

  let dragstart: string
  let dragend: string

  const ladder = track('table', table(columns.map(({up: u, mid: m, down: d, ix}, i) => ({
    snabbis: [
      select_index(ix),
      S.on('contextmenu')((e: PointerEvent) => {
        e.preventDefault()
        Request({kind: 'revert_at', at: rich_diff[ix].id})
      }),
      S.attrs({ draggable: 'true' }),
      S.on('mousedown')((e: MouseEvent) => {
        dragstart = rich_diff[ix].id
      }),
      S.on('mouseup')((e: MouseEvent) => {
        dragend = rich_diff[ix].id
        Request({kind: 'connect_two', one: dragstart, two: dragend})
      }),
      S.on('dragstart')((e: DragEvent) => {
        dragstart = rich_diff[ix].id
      }),
      S.on('dragover')((e: DragEvent) => {
        dragend = rich_diff[ix].id
      }),
      S.on('dragend')((e: DragEvent) => {
        Request({kind: 'connect_two', one: dragstart, two: dragend})
      }),
      S.classes({[c.LadderSelected]: ix === selected_index}),
      C.Pointer
    ],
    col: [
      tag('div', C.Cell, u.length != 0 ? u : tag('div', C.InnerCell, '\u200b')),
      tag('div', C.Cell, m.length != 0 ? m : tag('div')),
      tag('div', C.Cell, d.length != 0 ? d : tag('div', C.InnerCell, '\u200b')),
    ]
  })), [c.LadderTable, c.MainStyle]))

  const pos_dict = store.get().positions
  const svg = tag(
    'svg',
    C.Width100Pct,
    S.styles({height: '500px'}),
    links.map(link => {
      const top = pos_dict[link.from]
      const bot = pos_dict[link.to]
      if (!top || !bot) return;
      const x1 = Positions.hmid(top)
      const y1 = Positions.bot(top)
      const x2 = Positions.hmid(bot)
      const y2 = bot.top // Positions.top(bot)
      const d = 25 * (-1 / (Math.abs(x1 - x2) + 1) + 1)
      const s = selected_index != null ? (rich_diff[selected_index] || {id: 'null'}).id : 'null'
      return tag('path',
        S.attrs({
          d: ['M', x1, y1, 'C', x1, y1 + d, x2, y2 - d, x2, y2].join(' '),
        }),
        C.Path,
        S.classes({[c.SelectedPath]: link.from == s || link.to == s})
      )
    }).filter(x => x != null)
  )

  let out = div(
    Positions.relative(ladder, svg, ['LadderRoot']),
    C.Unselectable
  )

  if (selected_index != null && selected_index < rich_diff.length) {
    // If this is the selected edge, instead add the component for editing the label set
    // NB: TODO: Add Undo functionality to labels
    out = div(
      S.classed(style(csstips.horizontal)),
      LabelEditor(
        G.label_store(store.at('graph').at('now'), rich_diff[selected_index].id),
        Request,
        store.at('selected_index'),
        taxonomy),
      out
    )
  }

  return out
}

function table(cols: {col: VNode[], snabbis: S[]}[], classes: string[] = []): VNode {
  return tag('div',
    C.Row,
    S.classed(...classes),
    ...cols.map(col => tag('div', C.Column, col.col, ...col.snabbis)))
}

const avg = (xs: number[]) => {
  if (xs.length == 0) {
    return null
  } else {
    return xs.reduce((x,y) => x+y, 0) / xs.length
  }
}

const diff_to_spans = (rules: (string | null)[]) => (d: [number, string][]) =>
  diff_helper(d, rules,
    (text, cls) => span(S.classed(cls), text))

const inserts = diff_to_spans([null, '', c.Insert])

const deletes = diff_to_spans([c.Delete, '', null])

function diff_helper<A>(token_diff: [number, string][], rules: (string | null)[], cb: (text: string, className: string) => A): A[] {
  const out = [] as A[]
  token_diff.map(([type, text]) => {
    const cls = rules[type + 1]
    if (cls != null) {
      out.push(cb(text, cls))
    }
  })
  return out
}

