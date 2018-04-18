import * as React from 'react'
import * as G from './Graph'
import {style} from 'typestyle'
import * as csstips from 'csstips'
import * as Utils from './Utils'
import * as record from './record'

import {VNode} from './ReactUtils'
import * as ReactUtils from './ReactUtils'

const intended_font_size = 16
const px = (i: number) => `${i / intended_font_size}em`

export const BorderCell = style(
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
      '& > ul > .bottom': {
        marginTop: `${px(3)}`,
        marginBottom: `${px(3)}`,
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
      '& del': {
        color: '#a00',
        textDecoration: 'none',
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

      '& .MustacheZ': {
        zIndex: -1,
      },
      '& .PathZ': {
        zIndex: -2,
      },

      '& .RelativeSVG': {
        position: 'relative',
        width: '100%',
        height: '100%',
      },
      '& .AbsoluteSVG': {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        // This needs to be <=0.5em, but smaller than that makes it not start
        // growing until a sufficiently high zoom
        fontSize: '0.25em',
      },

      // the point of the scaling up and down here is to make the vertical lines
      // be on exact pixel coordinates to not make them look blurry.
      '& .PixelPerfectOuter': {
        // table rounds the sizes in webengine
        display: 'table',
        // we try to make the sizes just about 50%
        width: 'calc(50% + 1px)',
        height: 'calc(50% + 1px)',
      },
      '& .PixelPerfectInner': {
        // and scale this div 200% of this to make it an even number of pixels
        width: '200%',
        height: '200%',
        position: 'absolute',
      },

      '.NoPixelPerfect & .PixelPerfectOuter': {
        display: 'block',
        width: '100%',
        height: '100%',
      },
      '.NoPixelPerfect & .PixelPerfectInner': {
        width: '100%',
        height: '100%',
        position: 'absolute',
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

  const under = (
    <div className="AbsoluteSVG MustacheZ" style={{top: '15%', left: '0.5px'}}>
      <svg height="200%" width="100%" viewBox="0 0 2 2" preserveAspectRatio="none">
        {mustache2x2}
      </svg>
    </div>
  )

  const above = (
    <div className="AbsoluteSVG MustacheZ" style={{top: '-100%', left: '0.5px'}}>
      <svg height="200%" width="100%" viewBox="0 0 2 2" preserveAspectRatio="none">
        <g transform="translate(0,2) scale(1,-1)">{mustache2x2}</g>
      </svg>
    </div>
  )

  return {under, above}
}

const brows = [make_brows(false), make_brows(true)]

function PixelPath(d: string, className: string) {
  return <path d={d} className={className} vectorEffect="non-scaling-stroke" />
}

function Line<M>({x0, y0, x1, y1}: G.Line<M>, className: string) {
  const ff = x1 != 0.5
  const yi = ff ? y1 : y0
  const xi = ff ? x0 : x1
  const d = `M ${x0} ${y0} C ${xi} ${yi} ${xi} ${yi} ${x1} ${y1}`
  return PixelPath(d, className)
}

function LineIsHorizontal<M>({y0, y1}: G.Line<M>) {
  return y0 == y1
}

const {inserts, deletes} = Utils.expr(() => {
  type Triplet<A> = [A, A, A]
  const diff_to_spans = (rules: Triplet<(s: string) => VNode | null>) => (
    token_diff: [number, string][]
  ) =>
    ReactUtils.Key(
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
  const ins = (text: string) => (text.trim() ? <ins>{text}</ins> : span(text))
  const del = (text: string) => (text.trim() ? <del>{text}</del> : span(text))
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
    return id === hover_id ? 'hover' : ''
  }
  return ''
}

export interface LineMeta {
  id: string
  manual: boolean
  hover: boolean
}

function Column(column: G.Line<LineMeta>[], rel: VNode | null | false = null): VNode {
  const endpoint_id: string | undefined = column
    .filter(line => !LineIsHorizontal(line))
    .map(line => line.meta.id)[0]

  const top = column.filter(line => line.meta.id == endpoint_id)
  const below = column.filter(line => line.meta.id != endpoint_id)
  return (
    <div className="RelativeSVG">
      {rel}
      <div className="AbsoluteSVG PixelPerfectOuter PathZ">
        <div className="PixelPerfectInner">
          <svg
            height="100%"
            width="100%"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            style={{zIndex: -2}}>
            {ReactUtils.Key([
              ...below.map(line =>
                Line(line, greyPath(line.meta.manual) + ' ' + (line.meta.hover ? ' hover ' : ''))
              ),
              ...(below.length == 0 ? [] : top.map(line => Line(line, whitePath))),
              ...top.map(line =>
                Line(line, greyPath(line.meta.manual) + ' ' + (line.meta.hover ? ' hover ' : ''))
              ),
            ])}
          </svg>
        </div>
      </div>
    </div>
  )
}

export interface LadderProps {
  graph: G.Graph
  orderChangingLabel?: (label: string) => boolean
  onHover?: OnHover
  onSelect?: OnSelect
  hoverId?: string
  selectedIds?: string[]
  side?: G.Side
  /** for hot module reloading, bumped at each reload and used to make sure thunked components get updated */
  generation?: number
}

export function Ladder(props: LadderProps): React.ReactElement<LadderProps> {
  const {
    graph,
    orderChangingLabel,
    onHover,
    onSelect,
    hoverId,
    selectedIds,
    side,
    generation,
  } = props
  const selected_ids = selectedIds || []
  const edges = graph.edges
  const rd0 = G.enrichen(graph, orderChangingLabel)
  const rd = G.restrict_to_side(rd0, side)
  const grids = G.mapGrids(G.DiffToGrid(rd), ({id}) => ({
    id,
    manual: graph.edges[id].manual === true,
    hover: hoverId === id,
  }))
  const u = grids.upper
  const l = grids.lower
  const c = Utils.count<string>()
  return (
    <div className={`${LadderStyle} ${ReactUtils.clean_ul} ${ReactUtils.Unselectable} ladder`}>
      {rd.map((d, i) =>
        ReactUtils.thunk(
          {
            ...d,
            index: undefined,
            u: u[i],
            l: l[i],
            hover_status: d.id === hoverId,
            e: edges[d.id],
            selected_status: edges[d.id].ids.map(x => selected_ids.some(id => id === x)),
            generation,
            side,
          },
          d.id + '#' + c.inc(d.id),
          () => {
            function HoverSpan(token_id: string, v: VNode) {
              return (
                <span
                  key={token_id}
                  className={
                    'Selectable' + (selected_ids.some(id => id === token_id) ? ' Selected' : '')
                  }
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
            const labels = graph.edges[d.id].labels.filter(lbl => lbl.length > 0)
            const brow_threshold = side ? (labels.length > 0 ? 0 : 1) : 1
            const [s, t] = Utils.expr((): [VNode, VNode] => {
              switch (d.edit) {
                case 'Edited':
                  return [
                    <div style={{position: 'relative'}} className={hoverClass(hoverId, d.id)}>
                      {d.source_diffs.map((ds, i) => HoverSpan(d.source[i].id, deletes(ds)))}
                      {d.source.length > brow_threshold && brows[~~d.manual].under}
                    </div>,
                    <div style={{position: 'relative'}} className={hoverClass(hoverId, d.id)}>
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
              has_line_below_label && !side
                ? [
                    {
                      x0: 0.5,
                      y0: 0,
                      x1: 0.5,
                      y1: 1,
                      meta: {id: d.id, manual: d.manual, hover: d.id === hoverId},
                    },
                  ]
                : []
            const mid = Column(
              line_below_label,
              labels.length > 0 &&
                show_label_now && (
                  <div className={BorderCell + ' ' + hoverClass(hoverId, d.id)}>
                    <div>{labels.map((l, i) => <span key={i}>{l}</span>)}</div>
                  </div>
                )
            )
            const on_hover: OnHover = id => onHover && hoverId !== id && onHover(id)
            return (
              <ul
                onClick={e => e.stopPropagation()}
                onMouseDown={e => {
                  if (onSelect) {
                    onSelect(edges[d.id].ids)
                  }
                  e.stopPropagation()
                }}
                onMouseEnter={() => on_hover(d.id)}
                onMouseLeave={() => on_hover(undefined)}>
                {side === 'target' || <li className={'top ' + hoverClass(hoverId, d.id)}>{s}</li>}
                {!side && <li className="upper">{Column(u[i])}</li>}
                <li className={(side || '') + ' mid'}>{mid}</li>
                {!side && <li className="lower">{Column(l[i])}</li>}
                {side === 'source' || (
                  <li className={'bottom ' + hoverClass(hoverId, d.id)}>{t}</li>
                )}
              </ul>
            )
          }
        )
      )}
    </div>
  )
}

export function ladder(graph: G.Graph): VNode {
  return <Ladder graph={graph} />
}
