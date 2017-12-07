import * as R from "ramda"
import { Taxonomy, DragState } from "./Model"
import * as Model from "./Model"
import { Token } from "./Token"
import { RichDiff } from './RichDiff'
// import * as R from './RichDiff'
import { Graph, Edge } from "./Graph"
import * as G from "./Graph"

import { Store, Lens, Undo } from "reactive-lens"

import { C, c } from './Classes'
import * as csstips from "csstips"
import * as Positions from "./Positions"

import * as Dropdown from "./Dropdown"

import { log } from './dev'
import { PosDict } from "./Positions"
import { style } from "typestyle"
import { tag, TagData, VNode, s, tags } from "snabbis"
const { div, span, tbody, tr, td } = tags
const { button, input, select } = s

import * as Utils from "./Utils"
import { TokenDiff }  from "./Utils"

export interface ViewDiffState {
  readonly graph: Undo<Graph>,            // ro
  readonly selected_index: number | null, // ro

  readonly positions: PosDict,            // rw
  readonly dropdown: Dropdown.State,      // rw
  readonly drag_state: Partial<DragState>
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

export function css(vn0: VNode, more_style: Record<string, string>): VNode {
  const vn = R.clone(vn0)
  const data = vn.data || {}
  const style = data.style || {}
  return {
    ...vn,
    data: {
      ...data,
      style: {
        ...style,
        ...more_style
      }
    }
  }
}

export function cls(vn0: VNode, more_class: Record<string, boolean>): VNode {
  const vn = R.clone(vn0)
  const data = vn.data || {}
  const _class = data.class || {}
  return {
    ...vn,
    data: {
      ...data,
      class: {
        ..._class,
        ...more_class
      }
    }
  }
}

export function ViewDiff(store: Store<ViewDiffState>, Request: (r: Model.Request) => void, rich_diff: RichDiff[], taxonomy: Taxonomy): VNode {

  let inp: HTMLInputElement | undefined

  // let dragstart: string
  // let dragend: string
  // let dragtype: 'rearrange' | 'merge'

  const drag_state = store.at('drag_state')

  const select_index = (index: number | null) => s.on('click')(e => {
    // store.at('selected_index').modify(ix_now => ix_now === ix ? null : ix)
    Request({kind: 'select_index', index})
    inp && inp.focus()
    e.stopPropagation()
  })

  const positions = store.at('positions')
  const floats = [] as VNode[]
  const track = (id: string, vnode: VNode) => {
    if (id != 'table') {
        let x = 1
      const table = positions.get()['table']
      const me = positions.get()[id]
      if (table && me) {
        floats.push(
          cls(css(vnode, {
            left: (me.left - table.left) + 'px',
            top: (me.top - table.top) + 'px',
            width: me.width + 'px',
            height: me.height + 'px',
          }), {[c.Floating]: true}))
      }
    }
    return Positions.posid(id, positions, cls(vnode, {[c.Hidden]: true}))
  }
  const links = [] as Link[]

  const source_for = (t: Token, diff: TokenDiff, edge_id: string, diff_index: number) => {
    links.push(Link(t.id, edge_id))
    return div(C.StretchSelf, C.Horizontal, track(t.id, div(deletes(diff), C.InnerCell, select_index(diff_index))),
      s.on('dblclick')((e: MouseEvent) => {
        e.preventDefault()
        Request({kind: 'disconnect_at', at: t.id})
      })
    )
  }
  const target_for = (t: Token, diff: TokenDiff, edge_id: string, diff_index: number) => {
    const events = () => [
      s.on('dragstart')((e: DragEvent) => {
        e.dataTransfer.setData('text/plain', 'https://stackoverflow.com/questions/19055264/why-doesnt-html5-drag-and-drop-work-in-firefox')
        drag_state.update({
          drag_type: 'rearrange',
          drag_start: t.id,
          drag_start_end: t.id,
          drag_over_last: [t.id]
        })
        // drag_state.at('drag_start').set(rich_diff[diff_index].id)
        log('dragstart', drag_state.get(), (e as any).target)
      }),
      /*
      s.on('dragend')((e: DragEvent) => {
        log('dragend', drag_state.get(), (e as any).target)
        const {drag_start, drag_over} = drag_state.get()
        if (drag_start && drag_over) {
        //   Request({kind: 'connect_two', one: drag_start, two: drag_over})
        }
        drag_state.set({})
      }),
      */
      s.on('dragenter')((e: DragEvent) => {
        const {drag_over, drag_start, drag_over_last} = drag_state.get()
        const last = (drag_over_last || []).slice(0, 2).filter(i => i == drag_over || i == drag_start)
        if (-1 == last.indexOf(t.id)) {
          drag_state.update({
            drag_over: t.id,
            drag_over_last: Utils.drop_adjacent_equal([t.id].concat(last))
          })
        }
        log('dragenter after', t.id, Utils.show(drag_state.get()), (e as any).target)
      }),
      s.on('dblclick')((e: MouseEvent) => {
        e.preventDefault()
        Request({kind: 'disconnect_at', at: t.id})
      }),
      select_index(diff_index),
    ]
    links.push(Link(edge_id, t.id))
    return div(
      C.StretchSelf,
      C.Horizontal,
      track(t.id,
        span(
          inserts(diff),
          C.Pointer, C.HoverMakesPurpleChildren, C.InnerCell,
          s.attrs({ draggable: 'true' }),
          ...events()
        )
      ),
      C.Pointer,
      C.HoverMakesPurpleChildren,
      s.attrs({ draggable: 'true' }),
      ...events()
    )
  }
  const {selected_index} = store.get()
  const selected_edge = selected_index != null ? (rich_diff[selected_index] || {id: 'null'}).id : 'null'
  const label_for = (edge_id: string, diff_index: number) =>
    track(edge_id, div(
        C.Horizontal,
        // C.StretchSelf,
        C.Pointer,
        C.CenterSelf,
        select_index(diff_index),
        span(
          edges[edge_id].labels.map(
            code => span(
              code + ' ',
              s.classes({
                [red]: diff_index !== selected_index && taxonomy.every(g => g.choices.every(alt => alt.value != code))
              })
            )
          ),
          C.BorderCell,
          s.css({height: 'min-content'}),
          s.attrs({ draggable: 'true' }),
          s.classes({[c.SelectedBorderCell]: edge_id == selected_edge}),
        )
      )
    )


  const edges_done = new Set<string>()
  const edges = store.get().graph.now.edges
  const edge_ids = new Map<string, number>(rich_diff.map((e, i) => [e.id, i] as [string, number]))
  const group_by_id = R.groupWith((d: RichDiff, d2: RichDiff) => d.id == d2.id)
  const up = group_by_id(
    rich_diff.filter(d => d.edit != 'Dropped' || d.target_only)
  ).map((ds, ix) => {
    const edge_id = ds[0].id
    const need_label = !edges_done.has(edge_id)
    edges_done.add(edge_id)
    const label = need_label ? label_for(edge_id, edge_ids.get(edge_id) as number) : div()
    const up = [] as VNode[]
    ds.forEach(d => {
      switch(d.edit) {
        case 'Edited':
          d.source.map((s, i) =>
            up.push(source_for(s, d.source_diffs[i], d.id, edge_ids.get(d.id) as number))
          )
          return

        case 'Dragged':
          up.push(source_for(d.source, d.source_diff, d.id, edge_ids.get(d.id) as number))
          return
      }
    })
    return div(
      C.Vertical,
      C.UpMid,
      // s.css({height: '170px', justifyContent: 'space-between'}),
      div(C.Horizontal, up), label
    )
  })

  const down = [] as VNode[]

  rich_diff.forEach((d, ix) => {
    switch(d.edit) {
      case 'Edited':
        d.target.map((t, i) =>
          down.push(target_for(t, d.target_diffs[i], d.id, ix))
        )
        return

      case 'Dropped':
        down.push(target_for(d.target, d.target_diff, d.id, ix))
        return
    }
  })

  const ladder = track('table',
    div(C.InlineBlock, // we use this instead of width: fit-content
      div(C.Vertical, C.VSpaced,
        div(C.Row, C.JustUnderFloating, up),
//        div(C.Row, C.JustUnderFloating, mid),
        div(C.Row, C.JustUnderFloating, down)
      )
    )
  )

  const pos_dict = store.get().positions
  const svg = tag(
    'svg',
    C.Width100Pct,
    s.css({height: '500px'}),
    links.map(link => {
      const top = pos_dict[link.from]
      const bot = pos_dict[link.to]
      if (!top || !bot) return;
      const x1 = Positions.hmid(top)
      const y1 = Positions.bot(top)
      const x2 = Positions.hmid(bot)
      const y2 = Positions.top(bot)
      const d = 30 * (-1 / (Math.abs(x1 - x2) + 1) + 1)
      return tag('path',
        s.attrs({
          d: ['M', x1, y1, 'C', x1, y1 + d, x2, y2 - d, x2, y2].join(' '),
        }),
        C.Path,
        s.classes({[c.SelectedPath]: link.from == selected_edge || link.to == selected_edge})
      )
    }).filter(x => x != null)
  )

  let out = div(
    Positions.relative(
      Positions.relative(ladder, div(...floats), [], []),
      svg, ['LadderRoot'], [c.Below]),
    C.Unselectable
  )

  if (selected_index != null && selected_index < rich_diff.length) {
    // If this is the selected edge, instead add the component for editing the label set
    // NB: TODO: Add Undo functionality to labels
    out = div(
      // s.classed(style(csstips.horizontal)),
      out,
      div(Dropdown.Dropdown(store.at('dropdown'), taxonomy, inp_ => { inp = inp_; inp && inp.focus() }),
        s.on('keydown')((e: KeyboardEvent) => {
          if (e.code == 'Tab') {
            Request(e.shiftKey ? 'prev' : 'next')
            e.preventDefault()
          } else if (e.code == 'Escape' || e.keyCode == 27) {
            Request({kind: 'select_index', index: null})
          }
        }),
        s.on('click')(e => { log('defprev'), e.stopPropagation() })),
    )
  }

  return out
}

function table(cols: {col: VNode[], snabbis: TagData[]}[], classes: string[] = []): VNode {
  return tag('div',
    C.Row,
    s.classed(...classes),
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
    (text, cls) => span(s.classed(cls), text))

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

