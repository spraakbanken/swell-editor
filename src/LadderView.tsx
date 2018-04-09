import * as React from 'react'
import * as G from './Graph'
import * as RD from './RichDiff'
import {style, types} from 'typestyle'
import * as csstips from 'csstips'
import * as Utils from './Utils'
import * as record from './record'
import * as D from './Diff'

export type RestrictToSide = 'source' | 'target'

function RestrictToSide(rd: RD.RichDiff[], side?: RestrictToSide): RD.RichDiff[] {
  if (side === 'source') {
    return rd
      .filter(d => d.edit != 'Dropped')
      .map(d => (d.edit == 'Edited' ? {...d, target: [], target_diffs: []} : d))
  } else if (side === 'target') {
    return rd
      .filter(d => d.edit != 'Dragged')
      .map(d => (d.edit == 'Edited' ? {...d, source: [], source_diffs: []} : d))
  } else {
    return rd
  }
}

export function LadderComponent(props: {
  graph: G.Graph
  orderChangingLabel?: (label: string) => boolean
  onHover?: OnHover
  onSelect?: OnSelect
  hoverId?: string
  selectedIds?: string[]
  side?: RestrictToSide
}) {
  return Ladder(
    props.graph,
    props.orderChangingLabel,
    props.hoverId,
    props.onHover,
    props.selectedIds,
    props.onSelect,
    props.side
  )
}

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
  csstips.horizontal,
  csstips.centerJustified,
  {
    zIndex: 10,
  },
  {
    $nest: {
      '& > div': {
        ...csstips.border(`${px(intended_font_size / 13)} #777 solid`),
        // csstips.border(`${px(1)} #777 solid`),
        borderRadius: `${px(2)}`,
        fontSize: `${px(13)}`,
        background: 'white',
        ...csstips.padding(px(5), px(3), px(1), px(3)),
        ...csstips.centerJustified,
      },
      '& > div> span:not(:last-child)': {
        paddingRight: `${px(4)}`,
        marginRight: `${px(4)}`,
      },
    },
  }
)

export const ManualPathColour = '#6699cc'

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
      '& > ul > .bottom': {
        marginTop: `${px(3)}`,
      },
      '& > ul > .source.mid': {
        marginTop: `${px(5)}`,
      },
      '& > ul > .target.mid': {
        marginBottom: `-${px(3)}`,
      },
      '& > ul > .upper, & > ul > .lower, & > ul > .mid': {
        height: `${px(24)}`,
      },
      '& div': {
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
        zIndex: 11,
      },
      '& .GreyPath': {
        stroke: '#999',
        strokeWidth: px(4),
        fill: 'none',
      },
      '& .GreyPath.Manual': {
        stroke: ManualPathColour,
        strokeWidth: px(4),
        fill: 'none',
      },
      '& .WhitePath': {
        stroke: '#fff',
        strokeWidth: px(12),
        fill: 'none',
      },
    },
  }
)

const greyPath = (manual: boolean) => 'GreyPath ' + (manual ? 'Manual' : 'Auto')
const whitePath = 'WhitePath'

const make_brows = (manual: boolean) => {
  const mustache_side = PixelPath('M 0 0.90 C 0 1.1 1 0.85 1 1.15', greyPath(manual))

  const mustache2x2 = (
    <React.Fragment>
      {PixelPath('M 1 1.1 L 1 0.8', 'WhitePath')}
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

function PixelPath(d: string, className: string) {
  return <path d={d} className={className} vectorEffect="non-scaling-stroke" />
}

export function Key(nodes: VNode[], s: string | number = '') {
  return (
    <React.Fragment key={s}>
      {nodes.map((n, i) => <React.Fragment key={i}>{n}</React.Fragment>)}
    </React.Fragment>
  )
}

function Line({x0, y0, x1, y1, id}: D.Line, className: string) {
  const ff = x1 != 0.5
  const yi = ff ? y1 : y0
  const xi = ff ? x0 : x1
  const d = `M ${x0} ${y0} C ${xi} ${yi} ${xi} ${yi} ${x1} ${y1}`
  return PixelPath(d, className)
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

export interface OnHover {
  (id: string | undefined): void
}

export interface OnMenu {
  (id: string): void
}

export interface OnSelect {
  (ids: string[]): void
}

export function hoverClass(hover_id: string | undefined, id: string) {
  if (hover_id !== undefined) {
    return 'hoverable ' + (id === hover_id ? 'hover' : 'not-hover')
  }
  return 'hoverable'
}

export function Ladder(
  g: G.Graph,
  order_changing_label?: (label: string) => boolean,
  hover_id?: string,
  onHover?: OnHover,
  selected: string[] = [],
  onSelect?: OnSelect,
  side?: RestrictToSide
): VNode {
  if (selected.length > 0) {
    hover_id = undefined
  }

  const edges = g.edges

  function Column(column: D.Line[], rel: VNode | null | false = null): VNode {
    const endpoint_id: string | undefined = column
      .filter(line => !LineIsHorizontal(line))
      .map(line => line.id)[0]

    const top = column.filter(line => line.id == endpoint_id)
    const below = column.filter(line => line.id != endpoint_id)
    return (
      <div style={{position: 'relative', width: '100%', height: '100%'}}>
        {rel}
        {PixelPerfectSVG(
          <svg height="100%" width="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
            {Key([
              ...below.map(line =>
                Line(line, greyPath(!!edges[line.id].manual) + ' ' + hoverClass(hover_id, line.id))
              ),
              ...top.map(line => Line(line, whitePath)),
              ...top.map(line =>
                Line(line, greyPath(!!edges[line.id].manual) + ' ' + hoverClass(hover_id, line.id))
              ),
            ])}
          </svg>,
          {zIndex: -2}
        )}
      </div>
    )
  }

  const rd0 = RD.enrichen(g, order_changing_label)
  const rd = RestrictToSide(rd0, side)
  const grids = D.DiffToGrid(rd)
  const u = grids.upper
  const l = grids.lower
  return (
    <div className={`${LadderStyle} ${clean_ul} ${Unselectable} ladder`}>
      {rd.map((d, i) => {
        function is_hovering(token_id?: string) {
          return token_id === hover_id || d.id === hover_id
        }
        function HoverSpan(token_id: string, v: VNode) {
          return (
            <span
              key={token_id}
              className={'Selectable' + (selected.some(id => id === token_id) ? ' Selected' : '')}
              onMouseDown={e => {
                if (onSelect) {
                  e.stopPropagation()
                  onSelect([token_id])
                }
              }}>
              {v}
            </span>
          )
        }
        const labels = g.edges[d.id].labels.filter(lbl => lbl.length > 0)
        const brow_threshold = side ? (labels.length > 0 ? 0 : 1) : 1
        const [s, t] = Utils.expr((): [VNode, VNode] => {
          switch (d.edit) {
            case 'Edited':
              return [
                <div style={{position: 'relative'}}>
                  {d.source_diffs.map((ds, i) => HoverSpan(d.source[i].id, deletes(ds)))}
                  {d.source.length > brow_threshold && brows[~~d.manual].under}
                </div>,
                <div style={{position: 'relative'}}>
                  {d.target_diffs.map((ds, i) => HoverSpan(d.target[i].id, inserts(ds)))}
                  {d.target.length > brow_threshold && brows[~~d.manual].above}
                </div>,
              ]
            case 'Dragged':
              return [
                <div>{HoverSpan(d.source.id, deletes(d.source_diff))}</div>,
                <React.Fragment />,
              ]
            case 'Dropped':
              return [
                <React.Fragment />,
                <div>{HoverSpan(d.target.id, inserts(d.target_diff))}</div>,
              ]
          }
        })
        const show_label_now = u[i].some(b => b.y1 == 1) || l[i].some(b => b.y1 == 0)
        const has_line_below_label = show_label_now && l[i].length > 0
        const line_below_label =
          has_line_below_label && !side ? [{x0: 0.5, y0: 0, x1: 0.5, y1: 1, id: d.id}] : []
        const mid = Column(
          line_below_label,
          labels.length > 0 &&
            show_label_now && (
              <div className={BorderCell}>
                <div>{labels.map((l, i) => <span key={i}>{l}</span>)}</div>
              </div>
            )
        )
        const on_hover: OnHover = id => onHover && hover_id !== id && onHover(id)
        return (
          <ul
            onMouseDown={e => {
              if (onSelect) {
                onSelect(edges[d.id].ids)
              }
              e.stopPropagation()
            }}
            onMouseEnter={() => on_hover(d.id)}
            onMouseLeave={() => on_hover(undefined)}
            key={d.index}>
            {side === 'target' || <li className={'top ' + hoverClass(hover_id, d.id)}>{s}</li>}
            {!side && <li className="upper">{Column(u[i])}</li>}
            <li className={(side || '') + ' mid'}>{mid}</li>
            {!side && <li className="lower">{Column(l[i])}</li>}
            {side === 'source' || <li className={'bottom ' + hoverClass(hover_id, d.id)}>{t}</li>}
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
