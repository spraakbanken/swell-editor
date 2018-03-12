import * as React from 'react'
import * as G from './Graph'
import * as RD from './RichDiff'
import {style, types} from 'typestyle'
import * as csstips from 'csstips'
import * as Utils from './Utils'
import * as D from './Diff'

export type VNode = React.ReactElement<{}>

export const clean_ul = style(Utils.debugName('clean_ul'), {
  $nest: {
    '& ul, & ol': {
      padding: '0px',
    },
    '& li': {
      listStyle: 'none',
    },
  },
})

const intended_font_size = 16
const px = (i: number) => `${i / intended_font_size}em`

export const Unselectable = style(Utils.debugName('Unselectable'), {
  '-moz-user-select': 'none',
  '-webkit-touch-callout': 'none',
  '-webkit-user-select': 'none',
  '-ms-user-select': 'none',
  userSelect: 'none',
  cursor: 'default',
})

const BorderCell = style(
  Utils.debugName('BorderCell'),
  csstips.border(`${px(intended_font_size / 13)} #777 solid`),
  // csstips.border(`${px(1)} #777 solid`),
  {borderRadius: `${px(2)}`},
  {fontSize: `${px(13)}`},
  {background: 'white'},
  csstips.padding(px(5), px(3), px(1), px(3)),
  csstips.centerJustified,
  {
    $nest: {
      '& > span:not(:last-child)': {
        paddingRight: `${px(4)}`,
        marginRight: `${px(4)}`,
      },
    },
  }
)

const LadderStyle = style(
  Utils.debugName('LadderStyle'),
  csstips.wrap,
  csstips.startJustified,
  csstips.horizontal,
  csstips.inlineRoot,
  {
    $nest: {
      '& > ul': {
        ...csstips.vertical,
        borderTop: `${px(1)} #ccc solid`,
        borderBottom: `${px(1)} #ccc solid`,
        marginBottom: `${px(20)}`,
      },
      '& > ul > li': {
        height: `${px(20)}`,
        width: '100%',
        marginRight: `${px(3)}`,
        marginLeft: `${px(3)}`,
        ...csstips.selfCenter,
        ...csstips.horizontal,
        ...csstips.centerJustified,
      },
      // note: li indexes starts from 1
      '& > ul > li:nth-child(3)': {
        height: `${px(24)}`,
      },
      '& > ul > li:nth-child(even)': {
        height: `${px(24)}`,
      },
      '& *': {
        color: '#222',
      },
      '& ins': {
        color: '#070',
        textDecoration: 'none',
      },
      '& del ': {
        color: '#d00',
        textDecoration: 'none',
      },
    },
  }
)

export function Key(nodes: VNode[], s: string | number = '') {
  return (
    <React.Fragment key={s}>
      {nodes.map((n, i) => <React.Fragment key={i}>{n}</React.Fragment>)}
    </React.Fragment>
  )
}

function Line({x0, y0, x1, y1, id}: D.Line, css: React.CSSProperties) {
  const ff = x1 != 0.5
  const yi = ff ? y1 : y0
  const xi = ff ? x0 : x1
  const d = `M ${x0} ${y0} C ${xi} ${yi} ${xi} ${yi} ${x1} ${y1}`
  return <path vectorEffect="non-scaling-stroke" d={d} style={{...css, fill: 'none'}} />
}

function LineIsHorizontal({y0, y1}: D.Line) {
  return y0 == y1
}

function Column(column: D.Line[], rel: VNode | null | false = null): VNode {
  const endpoint_id: string | undefined = column
    .filter(line => !LineIsHorizontal(line))
    .map(line => line.id)[0]
  const grey: React.CSSProperties = {stroke: '#777', strokeWidth: px(4)}
  const white: React.CSSProperties = {stroke: '#fff', strokeWidth: px(12)}
  return (
    // the point of the scaling up and down here is to make the vertical lines
    // be on exact pixel coordinates to not make them look blurry.
    <li style={{position: 'relative'}}>
      {rel}
      <div
        style={{
          position: 'absolute',
          top: '0',
          left: '0',
          // This needs to be <=0.5em, but smaller than that makes it not start
          // growing until a sufficiently high zoom
          fontSize: '0.25em',
          // table rounds the sizes in webkit
          display: 'table',
          // we try to make the sizes just about 50%
          width: 'calc(50% + 1px)',
          height: 'calc(50% + 1px)',
        }}>
        <div
          style={{
            // and scale this div 200% of this to make it an even number of pixels
            width: '200%',
            height: '200%',
            position: 'absolute',
          }}>
          <svg height="100%" width="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
            {Key([
              ...column.filter(line => line.id != endpoint_id).map(line => Line(line, grey)),
              ...column.filter(line => line.id == endpoint_id).map(line => Line(line, white)),
              ...column.filter(line => line.id == endpoint_id).map(line => Line(line, grey)),
            ])}
          </svg>
        </div>
      </div>
    </li>
  )
}

const {inserts, deletes} = Utils.expr(() => {
  type Triplet<A> = [A, A, A]
  const diff_to_spans = (rules: Triplet<(s: string) => VNode | null>) => (
    token_diff: [number, string][]
  ) =>
    Key(
      Utils.expr(() => {
        const out = [] as VNode[]
        token_diff.map(([type, text]) => {
          const node = rules[type + 1](text)
          if (node != null) {
            out.push(node)
          }
        })
        return out
      })
    )

  const skip = () => null
  const span = (text: string) => <span>{text}</span>
  const ins = (text: string) => <ins>{text}</ins>
  const del = (text: string) => <del>{text}</del>
  return {
    inserts: diff_to_spans([skip, span, ins]),
    deletes: diff_to_spans([del, span, skip]),
  }
})

export type DragState = {type: 'move'; from: number; to: number} | null
//  | { request: 'merge', edge_ids: string[] }

export function ApplyMove(diff: D.Diff[], {from, to}: {from: number; to: number}): D.Diff[] {
  const d = diff[from]
  switch (d.edit) {
    case 'Dropped':
      return Utils.rearrange(diff, from, from, to)
    case 'Edited':
      if (d.source.length != 1 || d.target.length != 1) {
        console.error('TODO: handle Edited that is not 1-1')
        console.debug(Utils.show(d))
        return diff
      }
      const dragged = D.Dragged(d.source[0], d.id)
      const dropped = D.Dropped(d.target[0], d.id)
      const [pre, [e], post] = Utils.splitAt3(diff, from, from + 1)
      return ApplyMove([...pre, dropped, dragged, ...post], {from, to})
    default:
      return diff
  }
}

export function Ladder(
  g: G.Graph,
  rd0: RD.RichDiff[] = RD.enrichen(g),
  drag_state?: DragState,
  onDrag?: (ds: DragState) => void,
  onDrop?: (ds: DragState) => void
): VNode {
  const rd = drag_state ? RD.enrichen(g, ApplyMove(rd0, drag_state)) : rd0
  const grids = D.DiffToGrid(rd)
  const u = grids.upper
  const l = grids.lower
  return (
    <div
      onMouseLeave={e => onDrag && onDrag(null)}
      className={`${LadderStyle} ${clean_ul} ${Unselectable} ladder`}>
      {rd.map((d, i) => {
        const [s, t] = Utils.expr((): [VNode, VNode] => {
          switch (d.edit) {
            case 'Edited':
              return [
                <div>{Key(d.source_diffs.map(deletes))}</div>,
                <div>{Key(d.target_diffs.map(inserts))}</div>,
              ]
            case 'Dragged':
              return [deletes(d.source_diff), <React.Fragment />]
            case 'Dropped':
              return [<React.Fragment />, inserts(d.target_diff)]
          }
        })
        const upper = Column(u[i])
        const lower = Column(l[i])
        const labels = g.edges[d.id].labels.filter(lbl => lbl.length > 0)
        const show_label_now = u[i].some(b => b.y1 == 1) || l[i].some(b => b.y1 == 0)
        const has_line_below_label = show_label_now && l[i].length > 0
        const line_below_label = has_line_below_label
          ? [{x0: 0.5, y0: 0, x1: 0.5, y1: 1, id: d.id}]
          : []
        const mid = Column(
          line_below_label,
          labels.length > 0 &&
            show_label_now && (
              <div style={{zIndex: 1}}>
                <div className={BorderCell}>{labels.map((l, i) => <span key={i}>{l}</span>)}</div>
              </div>
            )
        )
        return (
          <ul
            key={d.index}
            onMouseMove={e => {
              if (drag_state) {
                const hover = drag_state.to
                const to = i
                const w = e.currentTarget.clientWidth
                const x0 = e.currentTarget.offsetLeft
                const x = e.pageX
                const left = x - x0 < w / 2
                const yes_left = to < hover - 1 || (to == hover - 1 && left)
                const yes_right = to > hover + 1 || (to == hover + 1 && !left)
                const yes = yes_left || yes_right
                onDrag && yes && onDrag({...drag_state, to})
              }
            }}
            onMouseUp={e => {
              onDrop && drag_state && (onDrop(drag_state), e.preventDefault())
            }}>
            <li>{s}</li>
            {upper}
            {mid}
            {lower}
            <li
              style={{cursor: 'pointer', background: '#fff0'}}
              onMouseDown={e => onDrag && onDrag({type: 'move', from: i, to: i})}>
              {t}
            </li>
          </ul>
        )
      })}
    </div>
  )
}
