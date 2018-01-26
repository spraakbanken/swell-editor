import * as React from 'react'
import * as G from './Graph'
import * as RD from './RichDiff'
import {style, types} from 'typestyle'
import * as csstips from 'csstips'
import * as Utils from './Utils'
import * as D from './Diff'

export type VNode = React.ReactElement<{}>

export const clean_ul = style({
  $debugName: 'clean_ul',
  $nest: {
    '& ul, & ol': {
      padding: '0px',
    },
    '& li': {
      listStyle: 'none',
    },
  },
})

const BorderCell = style(
  {$debugName: 'BorderCell'},
  csstips.border('1px #777 solid'),
  {borderRadius: '2px'},
  {fontSize: '13px'},
  {background: 'white'},
  csstips.padding('4px', '4px'),
  csstips.centerJustified,
  {
    $nest: {
      '& > span:not(:last-child)': {
        paddingRight: '4px',
        marginRight: '4px',
      },
    },
  }
)

const LadderStyle = style(
  {$debugName: 'LadderStyle'},
  {fontSize: '16px'},
  csstips.wrap,
  csstips.startJustified,
  csstips.horizontal,
  {
    $nest: {
      '& > ul': {
        ...csstips.vertical,
        borderTop: '1px #ccc solid',
        borderBottom: '1px #ccc solid',
        marginBottom: '20px',
      },
      '& > ul > li': {
        height: '20px',
        width: '100%',
        ...csstips.selfCenter,
        ...csstips.horizontal,
        paddingRight: '3px',
        paddingLeft: '3px',
        justifyContent: 'center',
      },
      '& > ul > li:nth-child(3)': {
        height: '24px',
      },
      '& > ul > li:nth-child(even)': {
        fontSize: '0px',
        height: '24px',
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
  const grey: React.CSSProperties = {stroke: '#777', strokeWidth: 2}
  const white: React.CSSProperties = {stroke: '#fff', strokeWidth: 6}
  return (
    <li style={{position: 'relative'}}>
      {rel}
      <div
        style={{
          position: 'absolute',
          top: '0',
          left: '0',
          // table rounds the sizes in webkit
          display: 'table',
          // we try to make the sizes just about 50%
          fontSize: '0px',
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

export function Ladder(g: G.Graph, rd: RD.RichDiff[] = RD.enrichen(g)): VNode {
  const grids = D.DiffToGrid(rd)
  const u = grids.upper
  const l = grids.lower
  return (
    <div className={`${LadderStyle} ${clean_ul}`}>
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
          <ul key={i}>
            <li>{s}</li>
            {upper}
            {mid}
            {lower}
            <li>{t}</li>
          </ul>
        )
      })}
    </div>
  )
}
