import { Taxonomy } from "./Model"
import { Token } from "./Token"
import { RichDiff } from './RichDiff'
import * as R from './RichDiff'
import { Graph, Edge } from "./Graph"
import * as G from "./Graph"

import { Store, Lens, Undo } from "reactive-lens"

import * as Classes from './Classes'
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

function LabelEditor(store: Store<string[]>, taxonomy: Taxonomy): VNode {
  // TODO: fiddle with focus change too:
  // see Diff.next and Diff.prev (but they should be adapted to go over sentence boundaries)
  return div(
    S.styles({marginTop: '20px', marginBottom: '20px'}),
    S.classed(Classes.BorderCell),
    S.on('click')((e: MouseEvent) => {
      // if we click anywhere but here we should deselect. so there's another listener somewhere
      e.stopPropagation()
    }),
    div(
      CatchSubmit(
        () => console.log('Enter pressed, move to next/previous sentence'),
        InputField(
          Utils.store_join(store).via(Lens.iso(s => s.toUpperCase(), s => s)),
          S.attrs({autofocus: true}),
          S.hook({insert: (vn) => (vn.elm as HTMLInputElement).focus()})
         )
      ),
    ),
    div(
      S.styles({width: '160px'}),
      S.classed(style(csstips.horizontallySpaced('5px'))),
      taxonomy.map(t => {
        const tstore = Utils.array_store_key(store, t.code)
        const active = tstore.get()
        return tag('span',
          S.styles({display: 'inline-block'}),
          t.code + ' ',
          S.styles({cursor: 'pointer'}),
          S.on('click')(() => (console.log(tstore, tstore.get()), tstore.modify(x => !x))),
          S.classes({[orange]: tstore.get()}),
        )
      }),
      tag('a', 'info', S.styles({float: 'right'}),
        S.attrs({
          href: 'https://spraakbanken.gu.se/eng/swell/swell_codebook',
          target: '_blank'
        }))
    )
  )
}

export function ViewDiff(store: Store<ViewDiffState>, rich_diff: RichDiff[], taxonomy: Taxonomy): VNode {

  const select_index = (ix: number | null) => S.on('click')(e => {
    store.at('selected_index').modify(ix_now => ix_now === ix ? null : ix)
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
    up.push(track(s.id, span(deletes(diff), S.classed(Classes.InnerCell))))
    links.push(Link(s.id, edge_id))
  }
  const new_target = (t: Token, diff: TokenDiff, edge_id: string) => {
    down.push(track(t.id, span(inserts(diff), S.classed(Classes.InnerCell))))
    links.push(Link(edge_id, t.id))
  }
  const {selected_index} = store.get()
  const edges_done = new Set<string>()
  const edges = store.get().graph.now.edges
  const new_label = (edge_id: string, diff_index: number) => {
    if (!edges_done.has(edge_id)) {
      edges_done.add(edge_id)
      let vn: VNode
      if (diff_index === selected_index) {
        // If this is the selected edge, instead add the component for editing the label set
        // NB: TODO: Add Undo functionality to labels
        vn = LabelEditor(G.label_store(store.at('graph').at('now'), edge_id), taxonomy)
      } else {
        vn = div(
          S.classed(Classes.Vertical),
          S.on('click')((e: MouseEvent) => {
            e.stopPropagation()
            store.at('selected_index').set(diff_index)
          }),
          span(
            edges[edge_id].labels.join(' '),
            S.classed(Classes.BorderCell),
            S.styles({height: 'min-content'}),
          )
        )
      }
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

    S.on('click')(_ => store.at('selected_index').set(null))

  const ladder = track('table', table(columns.map(({up: u, mid: m, down: d, ix}, i) => [
    tag('div', select_index(ix), S.classed(Classes.Cell), u.length != 0 ? u : tag('div', S.classed(Classes.InnerCell), '\u200b')),
    tag('div', select_index(ix), S.classed(Classes.Cell), m.length != 0 ? m : tag('div')),
    tag('div', select_index(ix), S.classed(Classes.Cell), d.length != 0 ? d : tag('div', S.classed(Classes.InnerCell), '\u200b')),
  ]), [Classes.LadderTable, Classes.MainStyle]))

  const pos_dict = store.get().positions
  const svg = tag(
    'svg',
    S.classed(Classes.Width100Pct),
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
      return tag('path',
        S.attrs({
          d: ['M', x1, y1, 'C', x1, y1 + d, x2, y2 - d, x2, y2].join(' '),
        }),
        S.classed(Classes.Path)
      )
    }).filter(x => x != null)
  )
  return div(
    Positions.relative(ladder, svg, ['LadderRoot']),
    select_index(null)
  )
}

function table(cols: VNode[][], classes: string[] = []): VNode {
  return tag('div',
    S.classed(Classes.Row, ...classes),
    ...cols.map(col => tag('div', S.classed(Classes.Column), col)))
}

const avg = (xs: number[]) => {
  if (xs.length == 0) {
    return null
  } else {
    return xs.reduce((x,y) => x+y, 0) / xs.length
  }
}

const diff_to_spans = (rules: (string | null)[]) => (d: [number, string][]) =>
  diff_helper(d, rules, (text, cls) => tag('span', S.classed(cls), text))

const inserts = diff_to_spans([null, '', Classes.Insert])

const deletes = diff_to_spans([Classes.Delete, '', null])

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

