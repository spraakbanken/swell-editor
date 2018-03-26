import * as React from 'react'
import * as G from './Graph'
import * as RD from './RichDiff'
import {style, types} from 'typestyle'
import * as csstips from 'csstips'
import * as Utils from './Utils'
import * as record from './record'
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
        color: '#383',
        textDecoration: 'none',
      },
      '& del ': {
        color: '#a00',
        textDecoration: 'none',
      },
      '& .EditedTop': {
        boxShadow: `0 ${px(2)} 0 0 #777`,
        zIndex: 2,
      },
    },
  }
)

export const ManualPathColour = '#6699cc'

const greyPath = (manual: boolean): React.CSSProperties => ({
  stroke: manual ? ManualPathColour : '#999',
  strokeWidth: px(4),
  fill: 'none',
})
const whitePath: React.CSSProperties = {stroke: '#fff', strokeWidth: px(12), fill: 'none'}

const make_brows = (manual: boolean) => {
  const mustache_side = PixelPath('M 0 0.90 C 0 1.1 1 0.85 1 1.15', greyPath(manual))

  const mustache2x2 = (
    <React.Fragment>
      {PixelPath('M 1 1.1 L 1 0.8', whitePath)}
      {mustache_side}
      <g transform="translate(2, 0) scale(-1,1)">{mustache_side}</g>
    </React.Fragment>
  )

  const under = Absolute(
    <svg height="200%" width="100%" viewBox="0 0 2 2" preserveAspectRatio="none">
      {mustache2x2}
    </svg>,
    {zIndex: -1, position: 'absolute', top: '10%', left: '0.5px'}
  )
  const above = Absolute(
    <svg height="200%" width="100%" viewBox="0 0 2 2" preserveAspectRatio="none">
      <g transform="translate(0,2) scale(1,-1)">{mustache2x2}</g>
    </svg>,
    {zIndex: -1, position: 'absolute', top: '-100%', left: '0.5px'}
  )
  return {under, above}
}

const brows = [make_brows(false), make_brows(true)]

function PixelPath(d: string, css: React.CSSProperties) {
  return <path d={d} style={css} vectorEffect="non-scaling-stroke" />
}

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
  return PixelPath(d, css)
}

function LineIsHorizontal({y0, y1}: D.Line) {
  return y0 == y1
}

function PixelPerfectSVG(svg: VNode, css: React.CSSProperties = {}) {
  // the point of the scaling up and down here is to make the vertical lines
  // be on exact pixel coordinates to not make them look blurry.
  const more_css = {
    ...css,
    // table rounds the sizes in webengine
    display: 'table',
    // we try to make the sizes just about 50%
    width: 'calc(50% + 1px)',
    height: 'calc(50% + 1px)',
  }
  return Absolute(
    <div
      style={{
        // and scale this div 200% of this to make it an even number of pixels
        width: '200%',
        height: '200%',
        position: 'absolute',
      }}>
      {svg}
    </div>,
    more_css
  )
}

function Absolute(vnode: VNode, css: React.CSSProperties = {}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        // This needs to be <=0.5em, but smaller than that makes it not start
        // growing until a sufficiently high zoom
        fontSize: '0.25em',
        ...css,
      }}>
      {vnode}
    </div>
  )
}

function Column(column: D.Line[], edges: G.Edges, rel: VNode | null | false = null): VNode {
  const endpoint_id: string | undefined = column
    .filter(line => !LineIsHorizontal(line))
    .map(line => line.id)[0]
  return (
    <li style={{position: 'relative'}}>
      {rel}
      {PixelPerfectSVG(
        <svg height="100%" width="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
          {Key([
            ...column
              .filter(line => line.id != endpoint_id)
              .map(line => Line(line, greyPath(!!edges[line.id].manual))),
            ...column.filter(line => line.id == endpoint_id).map(line => Line(line, whitePath)),
            ...column
              .filter(line => line.id == endpoint_id)
              .map(line => Line(line, greyPath(!!edges[line.id].manual))),
          ])}
        </svg>,
        {zIndex: -2}
      )}
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

export type DragState = {type: 'move'; from: number; to: number; over: boolean} | null
//  | { request: 'merge', edge_ids: string[] }

export function ApplyMove(diff: D.Diff[], {from, to}: {from: number; to: number}): D.Diff[] {
  const d = diff[from]
  switch (d.edit) {
    case 'Dropped':
      return Utils.rearrange(
        diff.map((d, i) => (i == from ? {...d, manual: true} : d)),
        from,
        from,
        to
      )
    case 'Edited':
      if (d.source.length != 1 || d.target.length != 1) {
        console.error('TODO: handle Edited that is not 1-1')
        console.debug(Utils.show(d))
        return diff
      }
      const dragged = D.Dragged(d.source[0], d.id, true)
      const dropped = D.Dropped(d.target[0], d.id, true)
      const [pre, [e], post] = Utils.splitAt3(diff, from, from + 1)
      return ApplyMove([...pre, dropped, dragged, ...post], {from, to})
    default:
      return diff
  }
}

export function HoverStyle(b: boolean) {
  if (b) {
    return {background: '#fe5', zIndex: -1}
  } else {
    return {}
  }
}

export interface OnHover {
  (id: string | undefined, what?: 'token' | 'edge'): void
}

export class LadderComponent extends React.Component<
  {
    graph: G.Graph
    onDrop?: (dropped_graph: G.Graph) => void
    onHover?: OnHover
    hoverId?: string
  },
  {
    drag_state: DragState
  }
> {
  constructor(p: any) {
    super(p)
    console.log('creating a new LadderComponent')
    this.state = {drag_state: null}
  }
  render() {
    const {graph, onDrop} = this.props
    return Ladder(
      graph,
      undefined,
      this.state.drag_state,
      drag_state => this.setState({drag_state}),
      drag_state => {
        if (drag_state && onDrop) {
          onDrop(G.diff_to_graph(ApplyMove(G.calculate_diff(graph), drag_state), graph.edges))
        }
        this.setState({drag_state: null})
      },
      this.props.hoverId,
      this.props.onHover
    )
  }
}

export function Ladder(
  g: G.Graph,
  rd0: RD.RichDiff[] = RD.enrichen(g),
  drag_state?: DragState,
  onDrag?: (ds: DragState) => void,
  onDrop?: (ds: DragState) => void,
  hover_id?: string,
  onHover?: OnHover
): VNode {
  const rd = drag_state && drag_state.over ? RD.enrichen(g, ApplyMove(rd0, drag_state)) : rd0
  const grids = D.DiffToGrid(rd)
  const u = grids.upper
  const l = grids.lower
  return (
    <div
      onMouseLeave={e => onDrag && drag_state && onDrag({...drag_state, over: false})}
      className={`${LadderStyle} ${clean_ul} ${Unselectable} ladder`}>
      {rd.map((d, i) => {
        function is_hovering(token_id?: string) {
          return token_id === hover_id || d.id === hover_id
        }
        function HoverSpan(token_id: string, v: VNode) {
          return (
            <span
              key={token_id}
              onMouseEnter={() => onHover && onHover(token_id, 'token')}
              onMouseLeave={() => onHover && onHover(undefined)}>
              <span style={HoverStyle(is_hovering(token_id))}>{v}</span>
            </span>
          )
        }
        const [s, t] = Utils.expr((): [VNode, VNode] => {
          switch (d.edit) {
            case 'Edited':
              return [
                <div style={{position: 'relative'}}>
                  {d.source_diffs.map((ds, i) => HoverSpan(d.source[i].id, deletes(ds)))}
                  {d.source.length > 1 && brows[~~d.manual].under}
                </div>,
                <div style={{position: 'relative'}}>
                  {d.target_diffs.map((ds, i) => HoverSpan(d.target[i].id, inserts(ds)))}
                  {d.target.length > 1 && brows[~~d.manual].above}
                </div>,
              ]
            case 'Dragged':
              return [HoverSpan(d.source.id, deletes(d.source_diff)), <React.Fragment />]
            case 'Dropped':
              return [<React.Fragment />, HoverSpan(d.target.id, inserts(d.target_diff))]
          }
        })
        const upper = Column(u[i], g.edges)
        const lower = Column(l[i], g.edges)
        const labels = g.edges[d.id].labels.filter(lbl => lbl.length > 0)
        const show_label_now = u[i].some(b => b.y1 == 1) || l[i].some(b => b.y1 == 0)
        const has_line_below_label = show_label_now && l[i].length > 0
        const line_below_label = has_line_below_label
          ? [{x0: 0.5, y0: 0, x1: 0.5, y1: 1, id: d.id}]
          : []
        const mid = Column(
          line_below_label,
          g.edges,
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
              if (onDrag && e.buttons === 1 && drag_state) {
                const hover = drag_state.to
                const to = i
                const w = e.currentTarget.clientWidth
                const x0 = e.currentTarget.offsetLeft
                const x = e.pageX
                const left = x - x0 < w / 2
                const yes_left = to < hover - 1 || (to == hover - 1 && left)
                const yes_right = to > hover + 1 || (to == hover + 1 && !left)
                const yes = yes_left || yes_right
                yes && onDrag({...drag_state, to, over: true})
              }
              if (onDrag && e.buttons === 0 && drag_state) {
                onDrag(null)
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
              onMouseDown={e =>
                e.buttons === 1 && onDrag && onDrag({type: 'move', from: i, to: i, over: true})
              }>
              {t}
            </li>
          </ul>
        )
      })}
    </div>
  )
}

import * as C from './Compact'

export function Align(source: string, target: string) {
  const s = C.parse(source)
  const t = C.parse(target)
  return Ladder(C.units_to_graph(s, t))
}

export function align(x: string) {
  const [source, target] = x.split('//')
  const s = C.parse(source)
  const t = C.parse(target)
  return Ladder(C.units_to_graph(s, t))
}
