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
import * as Spans from "./Spans"
import * as Utils from "./Utils"
import { log } from './dev'
import { on, span } from "./Snabbdom"
import { PosDict } from "./Positions"
import { style } from "typestyle"
import { tag, VNode, Content as S } from "snabbis"
import { TokenDiff }  from "./Utils"

export interface ViewDiffState {
  readonly graph: Undo<Graph>,
  readonly positions: PosDict,
  readonly selected_index: number | null,
}

interface Column {
  readonly up: VNode[],
  readonly mid: VNode[],
  readonly down: VNode[]
}

type Link = {
  readonly from: string,
  readonly to: string
}

function Link(from: string, to: string): Link {
  return {from, to}
}

export function ViewDiff(store: Store<ViewDiffState>, rich_diff: RichDiff[]): VNode {
  const em = G.edge_map(store.get().graph.now)
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
  const new_column = () => {
    up = []
    mid = []
    down = []
    column = {up, mid, down}
    columns.push(column)
  }
  new_column()

  const new_source = (s: Token, diff: TokenDiff, edge_id: string) => {
    up.push(track(s.id, span(deletes(diff), Classes.InnerCell)))
    links.push(Link(s.id, edge_id))
  }
  const new_target = (t: Token, diff: TokenDiff, edge_id: string) => {
    down.push(track(t.id, span(inserts(diff), Classes.InnerCell)))
    links.push(Link(edge_id, t.id))
  }
  const edges_done = new Set<string>()
  const new_label = (edge_id: string) => {
    if (!edges_done.has(edge_id)) {
      edges_done.add(edge_id)
      track(edge_id, span((em.get(edge_id) as Edge).labels.join(' '), Classes.BorderCell))

      // Here: if this is the selected edge, instead add the component for editing the label set
    }
  }

  rich_diff.forEach(d => {
    switch(d.edit) {
      case 'Edited':
        new_column()
        d.source.map((s, i) => new_source(s, d.source_diffs[i], d.id))
        new_label(d.id)
        d.target.map((t, i) => new_target(t, d.target_diffs[i], d.id))
        return

      case 'Dragged':
        new_source(d.source, d.source_diff, d.id)
        new_label(d.id)
        return

      case 'Dropped':
        new_label(d.id)
        new_target(d.target, d.target_diff, d.id)
        return
    }
  })

  const ladder = track('table', table(columns.map(({up: u, mid: m, down: d}, i) => [
    tag('div', S.classed(Classes.Cell), u.length != 0 ? u : tag('div', S.classed(Classes.InnerCell), '\u200b')),
    tag('div', S.classed(Classes.Cell), m.length != 0 ? m : tag('div')),
    tag('div', S.classed(Classes.Cell), d.length != 0 ? d : tag('div', S.classed(Classes.InnerCell), '\u200b')),
  ]), [Classes.LadderTable, Classes.MainStyle]))

  const pos_dict = store.get().positions
  const svg = tag('svg', S.classed(Classes.Width100Pct), links.map(link => {
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
  return Positions.relative(ladder, svg, ['LadderRoot'])
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

